import React, { lazy, Suspense, useCallback, useState, useEffect, useRef } from "react";
import { socket, connectSocket } from "./socket/client";
import { useChatStore } from "./store/useChatStore";
import { User, Message, Group, Channel, GroupCallParticipant } from "./types/chat";
import { callSounds } from "./utils/callSounds";
import {
  ArrowDown,
  Send,
  Paperclip,
  Mic,
  Smile,
  Settings,
  Plus,
  Search,
  LogOut,
  Phone,
  Video,
  X,
  PhoneOff,
  Check,
  Shield,
  Wallet,
  Bookmark,
  Users,
  PhoneCall,
  Moon,
  Sun,
  VideoOff,
  Lock,
  Camera,
  MicOff,
  UserPlus,
  MessageCircle,
} from "lucide-react";

import { COLORS, EMOJIS, STICKERS, VOICE_STICKERS } from "./shared/constants";
import { NexaLogo } from "./shared/ui/NexaLogo";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { Sidebar } from "./components/sidebar/Sidebar";
import { LaunchSplash } from "./components/LaunchSplash";
import { MessageBubble } from "./entities/message/ui/MessageBubble";
import { getInitials } from "./utils/helpers";
import { useVirtualizer } from "@tanstack/react-virtual";
import SoundUtility from "./utils/sound";
import { DecryptedText } from "./components/DecryptedText";
import { resolveApiUrl } from "./utils/api";
import { isNativeCapacitorApp } from "./utils/platform";
import { ensureNativeMediaPermissions } from "./utils/nativePermissions";
import { compressImageForUpload } from "./utils/mediaOptimization";
import {
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  migrateLegacyAuthStorage,
  storeAuthSession,
  updateStoredUser,
} from "./utils/session";
import type { ChannelComment, ChannelPost } from "./types/chat";
import type { NotificationType } from "./utils/notifications";

const AuthPage = lazy(() => import("./pages/auth/AuthPage").then((module) => ({ default: module.AuthPage })));
const MyProfileModal = lazy(() => import("./components/modals/MyProfileModal").then((module) => ({ default: module.MyProfileModal })));
const CreateGroupModal = lazy(() => import("./components/modals/CreateGroupModal").then((module) => ({ default: module.CreateGroupModal })));
const CreateChannelModal = lazy(() => import("./components/modals/CreateChannelModal").then((module) => ({ default: module.CreateChannelModal })));
const ProfileModal = lazy(() => import("./components/modals/ProfileModal").then((module) => ({ default: module.ProfileModal })));
const AdminPanel = lazy(() => import("./components/modals/AdminPanel").then((module) => ({ default: module.AdminPanel })));

type ImportedPhoneContact = {
  id: string;
  name: string;
  phones: string[];
  matchedPhone?: string | null;
  user?: User | null;
};

let sessionExpiredDispatched = false;

const normalizePhoneForClient = (phone?: string | null) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) return `7${digits.slice(1)}`;
  return digits;
};

const isMobileContactsDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad/i.test(navigator.userAgent) || Boolean((navigator as any).contacts?.select);
};

const inviteText = "Привет! Я пользуюсь NEXA Messenger. Присоединяйся: ";

const fetchWithRetry = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const method = (init?.method || "GET").toUpperCase();
  const canRetry = ["GET", "HEAD", "OPTIONS"].includes(method) && !init?.body;
  const attempts = canRetry ? 3 : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = !init?.signal ? new AbortController() : null;
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), 30000) : null;

    try {
      return await window.fetch(input, {
        ...init,
        signal: init?.signal || controller?.signal,
      });
    } catch (error) {
      if (!canRetry || attempt === attempts) throw error;
      // VPN tunnels can pause DNS/WebSocket routes during handoff; short backoff keeps sync from failing hard.
      await new Promise((resolve) => window.setTimeout(resolve, 350 * attempt));
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  return window.fetch(input, init);
};

// Safe wrapper around global fetch to transparently support relative calls to an external host on mobile/Capacitor
const apiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const token =
    typeof window !== "undefined" ? getAuthToken() : null;
  const withAuth = (requestInit?: RequestInit): RequestInit | undefined => {
    if (!token) return requestInit;
    const headers = new Headers(requestInit?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return { ...requestInit, headers };
  };

  if (
    typeof input === "string" &&
    input.startsWith("/") &&
    !input.startsWith("//")
  ) {
    const resolvedUrl = resolveApiUrl(input);
    return fetchWithRetry(resolvedUrl, withAuth(init)).then((response) => {
      if (
        response.status === 401 &&
        !input.startsWith("/api/auth/") &&
        !sessionExpiredDispatched
      ) {
        sessionExpiredDispatched = true;
        window.dispatchEvent(new CustomEvent("nexa:session-expired"));
      }
      return response;
    });
  }
  return fetchWithRetry(input, withAuth(init)).then((response) => {
    const inputText = typeof input === "string" ? input : input.toString();
    if (
      response.status === 401 &&
      !inputText.includes("/api/auth/") &&
      !sessionExpiredDispatched
    ) {
      sessionExpiredDispatched = true;
      window.dispatchEvent(new CustomEvent("nexa:session-expired"));
    }
    return response;
  });
};

// Shadow the global fetch identifier for this module
const fetch = apiFetch;

const readJsonResponse = async (response: Response, fallbackMessage: string) => {
  const text = await response.text();
  if (!text.trim()) {
    if (response.ok) {
      throw new Error(`${fallbackMessage}: пустой ответ сервера`);
    }
    return { error: `${fallbackMessage}: сервер вернул пустой ответ (${response.status})` };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: `${fallbackMessage}: сервер вернул некорректный ответ (${response.status})`,
    };
  }
};

const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return "";
  return url.startsWith("/") ? resolveApiUrl(url) : url;
};

const parseChannelAttachments = (
  attachments?: string,
): { url: string; type?: string; name?: string }[] => {
  if (!attachments) return [];
  try {
    const parsed = JSON.parse(attachments);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === "string") {
            return { url: item };
          }
          if (item && typeof item === "object") {
            return {
              url: item.url || item.path || "",
              type: item.type,
              name: item.name,
            };
          }
          return { url: "" };
        })
        .filter((item) => item.url);
    }
  } catch {
    // Fallback to the raw string below.
  }
  return [{ url: attachments }];
};

const E2EE_ENABLED = true;

const getUploadKind = (file: Blob, uploadedMime?: string): Message["type"] => {
  const mime = file.type || uploadedMime || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
};

const getMediaCaption = (type: Message["type"], originalName: string, textOverride?: string) => {
  if (textOverride) return textOverride;
  if (type === "image") return "Фото";
  if (type === "video") return "Видео";
  if (type === "audio") return "Голосовое сообщение";
  if (type === "file") return originalName && originalName !== "shared" ? originalName : "Файл";
  return "";
};

const pickSupportedMime = (candidates: string[]) => {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
};

const extensionForMime = (mime: string, fallback: string) => {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("webm")) return "webm";
  return fallback;
};

const uploadNameFor = (type: Message["type"], originalName: string, mime?: string) => {
  if (originalName && originalName !== "shared") return originalName;
  return `${type}-${Date.now()}.${extensionForMime(mime || "", type === "audio" || type === "video" ? "webm" : "bin")}`;
};

const App: React.FC = () => {
  // Detect Electron environment
  const isElectron = (window as any).electron?.isElectron === true;
  if (isElectron) {
    console.log('[Electron] Running in Electron environment - WebRTC calls fully supported!');
  } else {
    console.log('[Browser] Running in browser environment');
  }

  const {
    user,
    setUser,
    onlineUsers,
    setOnlineUsers,
    groups,
    setGroups,
    channels,
    setChannels,
    allUsers,
    setAllUsers,
    activeChat,
    setActiveChat,
    chats,
    chatClearedAt,
    setMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    setChatStates,
    updateGroup,
    addGroup,
    removeGroup,
    removeChannel,
  } = useChatStore();

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" | "warning" }>>([]);
  const notify = useCallback((message: string, type: "success" | "error" | "warning" = "error") => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerType, setPickerType] = useState<"emoji" | "sticker" | "voice">(
    "emoji",
  );
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(
    null,
  );
  const [forwardSearchTerm, setForwardSearchTerm] = useState("");
  const [expandedCommentPostId, setExpandedCommentPostId] = useState<string | null>(null);
  const [channelComments, setChannelComments] = useState<Record<string, ChannelComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  // Modals state
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileItem, setProfileItem] = useState<User | Group | Channel | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Competitor-inspired Menu State
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showContactsEntry, setShowContactsEntry] = useState(isMobileContactsDevice);
  const [phoneContacts, setPhoneContacts] = useState<ImportedPhoneContact[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("nexa_phone_contacts") || "[]");
    } catch {
      return [];
    }
  });
  const [manualContactsText, setManualContactsText] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [showCallsModal, setShowCallsModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);

  // Theme & Appearance State
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem("nexa_theme") || "cosmic");
  const [chatWallpaper, setChatWallpaper] = useState(() => localStorage.getItem("nexa_wallpaper") || "");

  // Night Mode state
  const [nightMode, setNightMode] = useState(
    () => localStorage.getItem("nexa_night_mode") === "true",
  );

  useEffect(() => {
    setShowContactsEntry(isMobileContactsDevice());
  }, []);

  useEffect(() => {
    if (!showContactsEntry && showContactsModal) {
      setShowContactsModal(false);
    }
  }, [showContactsEntry, showContactsModal]);

  // Wallet and coins state
  const [walletBalance, setWalletBalance] = useState<number>(0);
  
  useEffect(() => {
    if (user && typeof user.balance === 'number') {
      setWalletBalance(user.balance);
    }
  }, [user]);
  const [walletTransactions, setWalletTransactions] = useState<
    {
      id: string;
      date: string;
      desc: string;
      amount: number;
      type: "in" | "out";
    }[]
  >(() => {
    const saved = localStorage.getItem("nexa_transactions");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: "tx_init",
            date: new Date().toLocaleDateString(),
            desc: "Приветственный бонус Nexa Grid",
            amount: 1337,
            type: "in",
          },
        ];
  });
  const [walletTransferUser, setWalletTransferUser] = useState("");
  const [walletTransferAmount, setWalletTransferAmount] = useState("");
  const [walletError, setWalletError] = useState("");
  const [walletSuccess, setWalletSuccess] = useState("");

  // Call duration log state
  const [callLogs, setCallLogs] = useState<
    {
      id: string;
      name: string;
      type: "audio" | "video";
      status: "missed" | "incoming" | "outgoing";
      time: string;
    }[]
  >(() => {
    const saved = localStorage.getItem("nexa_call_logs");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: "1",
            name: "Система ИИ",
            type: "audio",
            status: "incoming",
            time: "Сегодня, 14:20",
          },
        ];
  });

  // Call status overlay state
  const [callState, setCallState] = useState<{
    status: "idle" | "calling" | "incoming" | "connecting" | "connected" | "ended";
    partner?: User;
    type?: "audio" | "video";
    isMuted?: boolean;
    isVideoOff?: boolean;
    duration?: number;
  }>({ status: "idle" });
  const [groupCall, setGroupCall] = useState<{
    groupId: string | null;
    status: "idle" | "joining" | "connected";
    participants: GroupCallParticipant[];
    isMuted: boolean;
    duration: number;
  }>({
    groupId: null,
    status: "idle",
    participants: [],
    isMuted: false,
    duration: 0,
  });
  const [activeGroupCalls, setActiveGroupCalls] = useState<Record<string, GroupCallParticipant[]>>({});

  // Audio initialization flag
  const [audioInitialized, setAudioInitialized] = useState(false);

  // Profile Edit State
  // Admin Panel State
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminStats, setAdminStats] = useState<{
    totalUsers: number;
    totalGroups: number;
    totalMessages: number;
  } | null>(null);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminGroups, setAdminGroups] = useState<any[]>([]);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [adminTab, setAdminTab] = useState<
    "stats" | "users" | "groups" | "messages"
  >("stats");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoRecordingDuration, setVideoRecordingDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRecordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRecordingPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoNoteCancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef(activeChat);

  const chatWallpaperInputRef = useRef<HTMLInputElement>(null);

  const getDirectChatUser = useCallback((chatId: string | null): User | undefined => {
    if (!chatId) return undefined;
    if (user?.id === chatId) return user;
    return onlineUsers.find((u) => u.id === chatId) || allUsers.find((u) => u.id === chatId);
  }, [allUsers, onlineUsers, user]);
  
  const handleChatWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setChatWallpaper(base64);
        localStorage.setItem("nexa_wallpaper", base64);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleResetChatWallpaper = (e: React.MouseEvent) => {
     e.stopPropagation();
     setChatWallpaper("");
     localStorage.removeItem("nexa_wallpaper");
  };

  // Typing Indicator States
  const [typingUsers, setTypingUsers] = useState<
    Record<string, Record<string, { userName: string; timestamp: number }>>
  >({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCurrentlyTypingRef = useRef<boolean>(false);

  // WebRTC VoIP VoIP/Videocall references and states
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const groupCallStreamRef = useRef<MediaStream | null>(null);
  const groupPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const groupRemoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const allUsersRef = useRef(allUsers);
  const onlineUsersRef = useRef(onlineUsers);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const callStateRef = useRef(callState);
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);
  const groupCallRef = useRef(groupCall);
  useEffect(() => {
    groupCallRef.current = groupCall;
  }, [groupCall]);

  useEffect(() => {
    allUsersRef.current = allUsers;
  }, [allUsers]);

  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  // Initialize remote audio element on component mount
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.id = 'remote-audio';
      audio.autoplay = true;
      audio.volume = 1.0;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
      console.log('[Init] Created remote audio element:', audio);
    }
    return () => {
      // Keep the audio element for the session
    };
  }, []);

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  };

  const setupPeerConnection = (partnerId: string, stream: MediaStream) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    console.log('[WebRTC] Setting up peer connection');

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    // Add all local tracks
    stream.getTracks().forEach((track) => {
      console.log('[WebRTC] Adding track:', track.kind);
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket.connected) {
        socket.emit("call:signal", {
          to: partnerId,
          signal: { candidate: event.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected" && callStateRef.current.status !== "connected") {
        callSounds.playCallStartSound();
        setCallState((prev) => ({ ...prev, status: "connected", duration: 0 }));
      }
      if (["failed", "closed", "disconnected"].includes(pc.connectionState) && callStateRef.current.status === "connected") {
        setCallState((prev) => ({ ...prev, status: "ended" }));
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote audio/video track');
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
        
        // Handle both video and audio tracks
        const videoTracks = event.streams[0].getVideoTracks();
        const audioTracks = event.streams[0].getAudioTracks();
        
        if (videoTracks.length > 0 && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        
        if (audioTracks.length > 0) {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.volume = 1.0;
            
            // Force play
            remoteAudioRef.current.play()
              .then(() => console.log('[WebRTC] Audio playing'))
              .catch(err => {
                console.error('[WebRTC] Failed to play audio:', err);
                // Try again after a delay
                setTimeout(() => {
                  remoteAudioRef.current?.play().catch(e => console.error('[WebRTC] Retry play failed:', e));
                }, 500);
              });
          } else {
            console.error('[WebRTC] remoteAudioRef is null');
          }
        }
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const flushPendingIceCandidates = async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription || pendingIceCandidatesRef.current.length === 0) return;
    const candidates = pendingIceCandidatesRef.current.splice(0);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("[WebRTC] Failed to add queued ICE candidate:", error);
      }
    }
  };

  const removeGroupPeerConnection = (peerId: string) => {
    const pc = groupPeerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      groupPeerConnectionsRef.current.delete(peerId);
    }

    const audio = groupRemoteAudioRefs.current.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      groupRemoteAudioRefs.current.delete(peerId);
    }
  };

  const cleanupGroupCall = (emitLeave = true) => {
    const groupId = groupCallRef.current.groupId;
    if (emitLeave && groupId && socket.connected) {
      socket.emit("group-call:leave", { groupId });
    }

    groupPeerConnectionsRef.current.forEach((pc) => pc.close());
    groupPeerConnectionsRef.current.clear();
    groupRemoteAudioRefs.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    groupRemoteAudioRefs.current.clear();

    if (groupCallStreamRef.current) {
      groupCallStreamRef.current.getTracks().forEach((track) => track.stop());
      groupCallStreamRef.current = null;
    }

    setGroupCall({
      groupId: null,
      status: "idle",
      participants: [],
      isMuted: false,
      duration: 0,
    });
  };

  const setupGroupPeerConnection = (peerId: string, stream: MediaStream) => {
    const existing = groupPeerConnectionsRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      const groupId = groupCallRef.current.groupId;
      if (event.candidate && groupId && socket.connected) {
        socket.emit("group-call:signal", {
          groupId,
          to: peerId,
          signal: { candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      if (!event.streams?.[0]) return;

      let audio = groupRemoteAudioRefs.current.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.volume = 1;
        audio.style.display = "none";
        audio.dataset.groupCallPeer = peerId;
        document.body.appendChild(audio);
        groupRemoteAudioRefs.current.set(peerId, audio);
      }

      audio.srcObject = event.streams[0];
      audio.play().catch((error) => {
        console.warn("[GroupCall] Remote audio playback was delayed:", error);
      });
    };

    groupPeerConnectionsRef.current.set(peerId, pc);
    return pc;
  };

  const createGroupOfferForPeer = async (peerId: string) => {
    const groupId = groupCallRef.current.groupId;
    const stream = groupCallStreamRef.current;
    if (!groupId || !stream || peerId === user?.id) return;

    try {
      const pc = setupGroupPeerConnection(peerId, stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("group-call:signal", { groupId, to: peerId, signal: { sdp: offer } });
    } catch (error) {
      console.error("[GroupCall] Failed to create offer:", error);
    }
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState.isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState.isVideoOff]);

  useEffect(() => {
    activeChatRef.current = activeChat;
    setShowScrollToBottom(false);
  }, [activeChat]);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingDuration(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  useEffect(() => {
    if (isVideoRecording) {
      if (videoRecordingTimerRef.current) clearInterval(videoRecordingTimerRef.current);
      videoRecordingTimerRef.current = setInterval(() => {
        setVideoRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (videoRecordingTimerRef.current) clearInterval(videoRecordingTimerRef.current);
      setVideoRecordingDuration(0);
    }
    return () => {
      if (videoRecordingTimerRef.current) clearInterval(videoRecordingTimerRef.current);
    };
  }, [isVideoRecording]);

  useEffect(() => {
    if (!isVideoRecording || !videoRecordingPreviewRef.current || !videoStreamRef.current) return;
    videoRecordingPreviewRef.current.srcObject = videoStreamRef.current;
  }, [isVideoRecording]);

  const uploadFile = async (
    file: File | Blob,
    originalName: string,
    chatId: string,
    options?: { textOverride?: string },
  ) => {
    try {
      const uploadBlob = await compressImageForUpload(file, originalName);
      const formData = new FormData();
      formData.append("file", uploadBlob, originalName);

      const res = await fetch(resolveApiUrl("/api/upload"), {
        method: "POST",
        body: formData,
      });

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        throw new Error(
          `Server error: ${res.status}. File might be too large.`,
        );
      }

      if (!res.ok) throw new Error(data.error || "Upload failed");

      const uploadedMime = typeof data.type === "string" ? data.type : file.type;
      const type = getUploadKind(file, uploadedMime);
      const mediaUrl = resolveMediaUrl(data.url);
      if (!mediaUrl) throw new Error("Upload response did not include a media URL");
      const safeName =
        originalName && originalName !== "shared"
          ? originalName
          : uploadNameFor(type, data.name || originalName, uploadedMime);
      const caption = getMediaCaption(type, safeName, options?.textOverride);

      const isChannel = [...groups, ...(useChatStore.getState().channels || [])].some(
        c => c.id === chatId && (('isChannel' in c && c.isChannel) || (('isGroup' in c && c.name.includes('📢'))))
      );

      if (isChannel) {
        if (!socket.connected) return;
        socket.emit("channel:post:create", {
          channelId: chatId,
          content: caption,
          attachments: [{ url: mediaUrl, type, name: safeName }]
        });
      } else {
        const recipient = getDirectChatUser(chatId);
        const msgPayload = {
          to: chatId,
          type,
          data: mediaUrl,
          text: caption,
          mediaKind: options?.textOverride === "[VIDEO_NOTE]" ? "video-note" : undefined,
        };

        const optMsg: Message = {
          id: "opt_" + Date.now(),
          from: user!,
          fromId: user!.id,
          toUserId: recipient ? chatId : null,
          toGroupId: !recipient ? chatId : null,
          text: caption,
          type,
          data: mediaUrl,
          mediaKind: options?.textOverride === "[VIDEO_NOTE]" ? "video-note" : undefined,
          timestamp: new Date(),
          status: "sending",
        } as Message;
        addMessage(chatId, optMsg);
        SoundUtility.playSendMessage();

        if (socket.connected) {
          socket.emit("message:send", msgPayload);
        } else {
          const localDB = await import("./store/localDB");
          await localDB.queueSyncAction({
            id: Date.now().toString(),
            type: "message:send",
            payload: msgPayload,
          });
        }
      }
    } catch (err) {
      console.error("File upload failed:", err);
      notify("Не удалось загрузить файл");
    }
  };

  const startRecording = async () => {
    try {
      await ensureNativeMediaPermissions({ audio: true });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedMime([
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ]);
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioMime = mediaRecorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(chunks, { type: audioMime });
        if (activeChatRef.current) {
          uploadFile(
            audioBlob,
            `voice-message.${extensionForMime(audioMime, "webm")}`,
            activeChatRef.current,
          );
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      notify("Не удалось получить доступ к микрофону");
    }
  };

  const startVideoNoteRecording = async () => {
    try {
      await ensureNativeMediaPermissions({ audio: true, video: true });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" },
      });
      const mimeType = pickSupportedMime([
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ]);
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      videoRecorderRef.current = mediaRecorder;
      videoStreamRef.current = stream;
      videoNoteCancelledRef.current = false;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const videoMime = mediaRecorder.mimeType || mimeType || "video/webm";
        const videoBlob = new Blob(chunks, { type: videoMime });
        if (!videoNoteCancelledRef.current && activeChatRef.current && videoBlob.size > 0) {
          uploadFile(videoBlob, `video-note.${extensionForMime(videoMime, "webm")}`, activeChatRef.current, {
            textOverride: "[VIDEO_NOTE]",
          });
        }
        stream.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
        videoRecorderRef.current = null;
      };

      mediaRecorder.start(1000);
      setIsVideoRecording(true);
      setVideoRecordingDuration(0);
    } catch (err) {
      console.error("Failed to access camera for video note:", err);
      notify("Не удалось получить доступ к камере или микрофону");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopVideoNoteRecording = () => {
    if (videoRecorderRef.current && isVideoRecording) {
      videoRecorderRef.current.stop();
      setIsVideoRecording(false);
      if (videoRecordingTimerRef.current) clearInterval(videoRecordingTimerRef.current);
      setVideoRecordingDuration(0);
    }
  };

  const cancelVideoNoteRecording = () => {
    videoNoteCancelledRef.current = true;
    if (videoRecorderRef.current && isVideoRecording) {
      videoRecorderRef.current.stop();
    } else {
      videoStreamRef.current?.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    setIsVideoRecording(false);
    if (videoRecordingTimerRef.current) clearInterval(videoRecordingTimerRef.current);
    setVideoRecordingDuration(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;
    uploadFile(file, file.name, activeChat);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Toggle Night Mode
  const toggleNightMode = (checked: boolean) => {
    setNightMode(checked);
    localStorage.setItem("nexa_night_mode", String(checked));
    if (checked) {
      document.body.classList.add("night-mode");
    } else {
      document.body.classList.remove("night-mode");
    }
  };

  useEffect(() => {
    document.body.className = '';
    if (nightMode) document.body.classList.add('night-mode');
    if (activeTheme !== 'cosmic') document.body.classList.add(`theme-${activeTheme}`);
  }, [nightMode, activeTheme]);

  // Wallet Transfer helper
  const handleWalletTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setWalletError("");
    setWalletSuccess("");

    const amount = parseInt(walletTransferAmount);
    if (!walletTransferUser.trim()) {
      setWalletError("Пожалуйста, введите никнейм получателя");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setWalletError("Сумма перевода должна быть больше 0");
      return;
    }
    if (amount > walletBalance) {
      setWalletError("Недостаточно средств на балансе");
      return;
    }

    const targetUser =
      onlineUsers.find(
        (u) =>
          u.nickname.toLowerCase() === walletTransferUser.trim().toLowerCase(),
      ) ||
      (user?.nickname.toLowerCase() === walletTransferUser.trim().toLowerCase()
        ? user
        : null);

    const newBalance = walletBalance - amount;
    setWalletBalance(newBalance);
    localStorage.setItem("nexa_wallet_balance", String(newBalance));

    const newTx = {
      id: "tx_" + Date.now(),
      date: new Date().toLocaleDateString(),
      desc: `Перевод пользователю @${walletTransferUser.trim()}`,
      amount,
      type: "out" as const,
    };
    const updatedTxs = [newTx, ...walletTransactions];
    setWalletTransactions(updatedTxs);
    localStorage.setItem("nexa_transactions", JSON.stringify(updatedTxs));

    setWalletTransferUser("");
    setWalletTransferAmount("");
    setWalletSuccess(`Успешно переведено ${amount} кредитов!`);
  };

  // Calling handlers
  const handleInitiateCall = async (type: "audio" | "video") => {
    if (!activeChat) return;
    const partner =
      activeChat === user?.id ? null : getDirectChatUser(activeChat);
    if (!partner) return;

    try {
      cleanupCall();

      // Use electron-compatible media request
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === "video",
      };
      await ensureNativeMediaPermissions({ audio: true, video: type === "video" });
      
      // Check for Electron context
      let stream: MediaStream;
      if ((window as any).electron?.requestMediaPermission) {
        console.log("[Call] Using Electron media request");
        try {
          await (window as any).electron.requestMediaPermission({
            audio: true,
            video: type === "video",
          });
        } catch (err) {
          console.log("[Call] Electron IPC not available, using standard getUserMedia");
        }
      }
      
      stream = await navigator.mediaDevices.getUserMedia(constraints);

      localStreamRef.current = stream;
      setLocalStream(stream);

      SoundUtility.playCallInitiate();

      setCallState({
        status: "calling",
        partner,
        type,
        duration: 0,
        isMuted: false,
        isVideoOff: false,
      });

      socket.emit("call:initiate", { to: activeChat, type });
      // Play notification beep
      callSounds.playNotificationBeep();

      setCallLogs((prev) => {
        const logs = [
          {
            id: Date.now().toString(),
            name: partner.nickname,
            type,
            status: "outgoing" as const,
            time:
              "Сегодня, " +
              new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
          },
          ...prev,
        ];
        localStorage.setItem("nexa_call_logs", JSON.stringify(logs));
        return logs;
      });
    } catch (err) {
      console.error("Failed to access media devices for outgoing call:", err);
      notify("Потребуются разрешения на микрофон/камеру для совершения вызовов", "warning");
    }
  };

  const handleAcceptCall = async () => {
    const partner = callState.partner;
    if (!partner) return;
    try {
      callSounds.stopRingtone();
      cleanupCall();

      const type = callState.type || "audio";
      await ensureNativeMediaPermissions({ audio: true, video: type === "video" });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Show connecting state first
      setCallState((prev) => ({ ...prev, status: "connecting", duration: 0 }));
      socket.emit("call:accept", { to: partner.id });
      
      // Setup peer connection immediately for the recipient
      const pc = setupPeerConnection(partner.id, stream);
      
      // For recipient: transition to connected after delay (synchronized with caller)
      setTimeout(() => {
        if (callStateRef.current.status === "connecting") {
          callSounds.playCallStartSound();
          setCallState((prev) => ({ ...prev, status: "connected", duration: 0 }));
        }
      }, 1200);
    } catch (err) {
      console.error("Failed to access media devices for incoming call:", err);
      notify("Потребуются разрешения на микрофон/камеру для принятия вызова", "warning");
      handleRejectCall();
    }
  };

  const handleRejectCall = () => {
    callSounds.stopRingtone();
    callSounds.playCallEndSound();
    const partner = callStateRef.current.partner;
    if (partner) {
      socket.emit("call:reject", { to: partner.id });
    }
    cleanupCall();
    setCallState({ status: "idle" });
  };

  const handleEndCall = () => {
    callSounds.stopRingtone();
    callSounds.playCallEndSound();
    const partner = callStateRef.current.partner;
    if (partner) {
      socket.emit("call:end", { to: partner.id });
    }
    cleanupCall();
    setCallState({ status: "idle" });
  };

  const handleJoinGroupCall = async (groupId: string) => {
    if (!groupId || !user) return;
    if (callStateRef.current.status !== "idle") {
      notify("Завершите личный звонок перед входом в групповой голосовой чат", "warning");
      return;
    }

    if (groupCallRef.current.status !== "idle" && groupCallRef.current.groupId !== groupId) {
      cleanupGroupCall(true);
    }

    try {
      setGroupCall((prev) => ({
        ...prev,
        groupId,
        status: "joining",
        isMuted: false,
        duration: 0,
      }));

      if ((window as any).electron?.requestMediaPermission) {
        try {
          await (window as any).electron.requestMediaPermission({ audio: true, video: false });
        } catch (error) {
          console.log("[GroupCall] Electron media permission fallback:", error);
        }
      }

      await ensureNativeMediaPermissions({ audio: true });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      groupCallStreamRef.current = stream;
      socket.emit("group-call:join", { groupId });
      callSounds.playCallStartSound();
    } catch (error) {
      console.error("[GroupCall] Failed to join:", error);
      cleanupGroupCall(false);
      notify("Нужен доступ к микрофону для группового звонка", "warning");
    }
  };

  const handleLeaveGroupCall = () => {
    callSounds.playCallEndSound();
    cleanupGroupCall(true);
  };

  const handleToggleGroupMute = () => {
    const groupId = groupCallRef.current.groupId;
    if (!groupId || !groupCallStreamRef.current) return;

    const nextMuted = !groupCallRef.current.isMuted;
    groupCallStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setGroupCall((prev) => ({ ...prev, isMuted: nextMuted }));
    socket.emit("group-call:mute", { groupId, muted: nextMuted });
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return "00:00";
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Initialize AudioContext on first user interaction
  useEffect(() => {
    const initializeAudio = async () => {
      if (!audioInitialized) {
        await callSounds.initialize();
        setAudioInitialized(true);
      }
    };

    // Initialize on any user interaction
    window.addEventListener('click', initializeAudio, { once: true });
    window.addEventListener('touchstart', initializeAudio, { once: true });

    return () => {
      window.removeEventListener('click', initializeAudio);
      window.removeEventListener('touchstart', initializeAudio);
    };
  }, [audioInitialized]);

  useEffect(() => {
    let interval: any;
    if (callState.status === "connected") {
      interval = setInterval(() => {
        setCallState((prev) => ({
          ...prev,
          duration: (prev.duration || 0) + 1,
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState.status]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (groupCall.status === "connected") {
      interval = setInterval(() => {
        setGroupCall((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [groupCall.status]);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const { token: savedToken, user: savedUser } = await migrateLegacyAuthStorage();

      void import("./utils/e2ee").then((e2ee) => e2ee.hydrateLocalPrivateKey());

      if (cancelled || !savedUser) return;
      void import("./store/localDB").then((db) => db.setLocalDBUser(savedUser.id));
      setUser(savedUser);
      connectSocket(savedToken || undefined);
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!user || !token) return;

    void import("./utils/pushNotifications")
      .then(({ enablePushNotifications }) => enablePushNotifications(token))
      .catch((error) => {
        console.warn("[PUSH] Failed to enable notifications:", error);
      });
  }, [user?.id]);

  const [isConnected, setIsConnected] = useState(socket.connected);

  // Self-heal/Bootstrap E2EE keys if missing
  useEffect(() => {
    if (!user) return;
    const healE2EE = async () => {
      const e2ee = await import("./utils/e2ee");
      const privKey = await e2ee.getLocalPrivateKeyAsync();
      if (!privKey || !user.publicKey) {
        try {
          const keyPair = await e2ee.generateKeyPair();
          e2ee.saveLocalPrivateKey(keyPair.privateKey);

          if (socket.connected) {
            socket.emit("profile:update", { publicKey: keyPair.publicKey });
          }
        } catch (e) {
          console.error("Self-healing E2EE generation failed:", e);
        }
      }
    };
    healE2EE();
  }, [user, isConnected]);

  useEffect(() => {
    const handleConnect = async () => {
      setIsConnected(true);
      socket.emit("join");
      // VPN and weak mobile networks often flap long-lived WebSocket tunnels.
      // Keep the queue local until a fresh connection exists, then replay once.
      try {
        const localDB = await import("./store/localDB");
        const queue = await localDB.getSyncQueue();
        if (queue.length > 0) {
          for (const q of queue) {
            if (q.type === "message:send") {
              socket.emit("message:send", q.payload);
            }
            await localDB.clearSyncAction(q.id);
          }
        }
      } catch (e) {
        console.error("Offline sync failed", e);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      if (groupCallRef.current.status !== "idle") {
        cleanupGroupCall(false);
      }
      setActiveGroupCalls({});
    };

    if (!user) return;

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    socket.on("users:online", (users: User[]) => {
      setOnlineUsers(users.filter((u) => u.id !== user.id));
    });

    socket.on("groups:update", (updatedGroups: Group[]) => {
      setGroups(updatedGroups);
    });

    socket.on("group:new", (newGroup: Group) => {
      addGroup(newGroup);
    });

    socket.on("group:updated", (group: Group) => {
      updateGroup(group);
    });

    socket.on("group:deleted", ({ groupId }) => {
      removeGroup(groupId);
      if (activeChatRef.current === groupId) {
        setActiveChat(null);
      }
    });

    socket.on("channels:update", (updatedChannels: Channel[]) => {
      setChannels(updatedChannels);
    });

    socket.on("chat:states", (states) => {
      setChatStates(states);
    });

    socket.on("channel:new", (newChannel: Channel) => {
      useChatStore.getState().addChannel(newChannel);
    });

    socket.on("channel:updated", (channel: Channel) => {
      useChatStore.getState().updateChannel(channel);
      setProfileItem((current) => current?.id === channel.id ? channel : current);
    });

    socket.on("channel:deleted", ({ channelId }) => {
      removeChannel(channelId);
      if (activeChatRef.current === channelId) {
        setActiveChat(null);
      }
    });

    socket.on("channel:history:result", ({ channelId, posts }) => {
      useChatStore.getState().setChannelPosts(channelId, posts);
      if (activeChatRef.current === channelId) {
        posts.forEach((post: ChannelPost) => {
          socket.emit("channel:post:view", { postId: post.id });
        });
      }
    });

    socket.on("channel:post:new", ({ channelId, post }) => {
      useChatStore.getState().addChannelPost(channelId, post);
    });

    socket.on("channel:post:updated", ({ channelId, post }) => {
      const state = useChatStore.getState();
      const existing = state.channelPosts[channelId] || [];
      const updated = existing.map(p => p.id === post.id ? post : p);
      state.setChannelPosts(channelId, updated);
    });

    socket.on("channel:comments:history:result", ({ postId, comments }) => {
      if (typeof postId !== "string" || !Array.isArray(comments)) return;
      setChannelComments((prev) => ({ ...prev, [postId]: comments }));
    });

    socket.on("channel:comment:new", ({ channelId, postId, comment, commentsCount }) => {
      if (typeof postId !== "string" || !comment) return;
      setChannelComments((prev) => {
        const existing = prev[postId] || [];
        if (existing.some((item) => item.id === comment.id)) return prev;
        return { ...prev, [postId]: [...existing, comment] };
      });
      if (typeof channelId === "string") {
        const state = useChatStore.getState();
        const existingPosts = state.channelPosts[channelId] || [];
        state.setChannelPosts(
          channelId,
          existingPosts.map((post) => post.id === postId ? { ...post, commentsCount } : post),
        );
      }
    });

    const isRelevantMessage = (msg: Message) => {
      if (msg.toGroupId) return true;
      return msg.fromId === user.id || msg.toUserId === user.id;
    };

    socket.on("message:new", (msg: Message) => {
      if (!isRelevantMessage(msg)) return;
      const chatKey =
        msg.toGroupId || (msg.fromId === user.id ? msg.toUserId : msg.fromId);
      if (msg.fromId === user.id) {
        msg.status = "sent";
      } else if (chatKey === activeChatRef.current && socket.connected) {
        socket.emit("message:read", { chatId: chatKey });
        msg.status = "read";
      }
      if (chatKey) addMessage(chatKey, msg);
    });

    socket.on("message:updated", (msg: Message) => {
      if (!isRelevantMessage(msg)) return;
      const chatKey =
        msg.toGroupId || (msg.fromId === user.id ? msg.toUserId : msg.fromId);
      if (chatKey) updateMessage(chatKey, msg);
    });

    socket.on(
      "message:deleted",
      ({ messageId, toGroupId, toUserId, fromId }) => {
        const chatKey = toGroupId || (fromId === user.id ? toUserId : fromId);
        if (chatKey) deleteMessage(chatKey, messageId);
      },
    );

    socket.on("messages:read", ({ chatId }) => {
      const existing = useChatStore.getState().chats[chatId]?.messages || [];
      const updated = existing.map((m) => {
        if (m.fromId === user.id && m.status !== "read") {
          return { ...m, status: "read" as const };
        }
        return m;
      });
      setMessages(chatId, updated);
    });

    socket.on("messages:delivered", ({ chatId }) => {
      const existing = useChatStore.getState().chats[chatId]?.messages || [];
      const updated = existing.map((m) => {
        if (m.fromId === user.id && m.status === "sent") {
          return { ...m, status: "delivered" as const };
        }
        return m;
      });
      setMessages(chatId, updated);
    });

    socket.on("message:history:result", ({ chatId, messages }) => {
      const visibleMessages = messages.filter(isRelevantMessage);
      visibleMessages.forEach((msg: Message) => {
        if (msg.fromId === user.id && msg.status !== "read")
          msg.status = "sent";
      });
      setMessages(chatId, visibleMessages);
    });

    socket.on("message:edit:error", ({ error }) => {
      notify(error || "Не удалось отредактировать сообщение");
    });

    socket.on("auth:expired", () => {
      handleLogout();
    });

    socket.on("connect_error", (err) => {
      if (err.message === "Authentication error") {
        handleLogout();
      } else if (!err.message.includes("xhr poll error") && !err.message.includes("timeout") && !err.message.includes("server error")) {
        console.warn("Socket connection issue:", err.message);
      }
    });

    socket.on("profile:updated", (updatedUser: User) => {
      if (user && updatedUser.id === user.id) {
        setUser(updatedUser);
        updateStoredUser(updatedUser);
      }
    });

    socket.on("profile:update:error", ({ error }) => {
      notify(error || "Не удалось сохранить профиль");
    });

    socket.on("call:incoming", ({ from, type }) => {
      const caller =
        allUsersRef.current.find((u) => u.id === from.id) ||
        onlineUsersRef.current.find((u) => u.id === from.id) ||
        from;

      if (callStateRef.current.status !== "idle") {
        socket.emit("call:reject", { to: from.id });
        return;
      }

      setCallState({
        status: "incoming",
        partner: caller,
        type,
        duration: 0,
        isMuted: false,
        isVideoOff: false,
      });
      // Play incoming call ringtone
      callSounds.playIncomingCallRingtone();
      setCallLogs((prev) => {
        const logs = [
          {
            id: Date.now().toString(),
            name: caller.nickname,
            type,
            status: "incoming" as const,
            time:
              "Сегодня, " +
              new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
          },
          ...prev,
        ];
        localStorage.setItem("nexa_call_logs", JSON.stringify(logs));
        return logs;
      });
    });

    socket.on("call:accepted", async () => {
      // Stop ringtone and play accepted sound
      callSounds.stopRingtone();
      callSounds.playAcceptedSound();
      
      // Show connecting state first
      setCallState((prev) => ({ ...prev, status: "connecting", duration: 0 }));
      
      const partnerId = callStateRef.current?.partner?.id;
      const stream = localStreamRef.current;
      if (partnerId && stream) {
        try {
          const pc = setupPeerConnection(partnerId, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("call:signal", { to: partnerId, signal: { sdp: offer } });
          
          // After a short delay, show call start sound and transition to connected
          // Use same timing as recipient for sync
          setTimeout(() => {
            if (callStateRef.current.status === "connecting") {
              callSounds.playCallStartSound();
              setCallState((prev) => ({ ...prev, status: "connected", duration: 0 }));
            }
          }, 1200);
        } catch (err) {
          console.error("Failed to create offer for WebRTC connection:", err);
        }
      }
    });

    socket.on("call:rejected", () => {
      callSounds.stopRingtone();
      callSounds.playCallEndSound();
      cleanupCall();
      setCallState({ status: "ended" });
      setTimeout(() => setCallState({ status: "idle" }), 2000);
    });

    socket.on("call:ended", () => {
      callSounds.stopRingtone();
      callSounds.playCallEndSound();
      cleanupCall();
      setCallState({ status: "ended" });
      setTimeout(() => setCallState({ status: "idle" }), 2000);
    });

    socket.on("call:signal", async ({ fromId, signal }) => {
      try {
        let pc = peerConnectionRef.current;
        if (!pc && localStreamRef.current) {
          pc = setupPeerConnection(fromId, localStreamRef.current);
        }

        if (pc) {
          if (signal.sdp) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signal.sdp),
            );
            await flushPendingIceCandidates(pc);
            if (signal.sdp.type === "offer") {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit("call:signal", {
                to: fromId,
                signal: { sdp: answer },
              });
            } else if (signal.sdp.type === "answer") {
              // When we receive answer, transition to connected if still in connecting state
              // But only if we haven't already transitioned due to timeout
              if (callStateRef.current.status === "connecting") {
                // Don't play sound again if timeout already did it
                setCallState((prev) => ({ ...prev, status: "connected", duration: 0 }));
              }
            }
          } else if (signal.candidate) {
            if (!pc.remoteDescription) {
              pendingIceCandidatesRef.current.push(signal.candidate);
            } else {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
          }
        }
      } catch (err) {
        console.error("Error handling call signal:", err);
      }
    });

    socket.on("group-call:joined", ({ groupId, participants, existingParticipantIds }) => {
      setActiveGroupCalls((prev) => ({ ...prev, [groupId]: participants || [] }));
      setGroupCall((prev) => ({
        ...prev,
        groupId,
        status: "connected",
        participants: participants || [],
        duration: prev.groupId === groupId ? prev.duration : 0,
      }));

      (existingParticipantIds || []).forEach((peerId: string) => {
        void createGroupOfferForPeer(peerId);
      });
    });

    socket.on("group-call:state", ({ groupId, participants }) => {
      setActiveGroupCalls((prev) => {
        const next = { ...prev };
        if (participants?.length) {
          next[groupId] = participants;
        } else {
          delete next[groupId];
        }
        return next;
      });
      setGroupCall((prev) => {
        if (prev.groupId !== groupId && prev.status === "idle") return prev;
        return {
          ...prev,
          groupId,
          participants: participants || [],
          status: prev.groupId === groupId ? prev.status : prev.status,
        };
      });
    });

    socket.on("group-call:ended", ({ groupId }) => {
      setActiveGroupCalls((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      if (groupCallRef.current.groupId === groupId) {
        cleanupGroupCall(false);
      }
    });

    socket.on("group-call:peer-left", ({ groupId, userId: peerId }) => {
      if (groupCallRef.current.groupId !== groupId) return;
      removeGroupPeerConnection(peerId);
      setGroupCall((prev) => ({
        ...prev,
        participants: prev.participants.filter((participant) => participant.userId !== peerId),
      }));
    });

    socket.on("group-call:signal", async ({ groupId, fromId, signal }) => {
      if (groupCallRef.current.groupId !== groupId || !groupCallStreamRef.current) return;

      try {
        const pc = setupGroupPeerConnection(fromId, groupCallStreamRef.current);
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("group-call:signal", { groupId, to: fromId, signal: { sdp: answer } });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (error) {
        console.error("[GroupCall] Failed to handle signal:", error);
      }
    });

    socket.on("group-call:error", ({ error }) => {
      cleanupGroupCall(false);
      notify(error || "Не удалось подключиться к групповому звонку");
    });

    socket.on("typing:update", ({ chatId, userId, userName, isTyping }) => {
      setTypingUsers((prev) => {
        const chatTyping = { ...(prev[chatId] || {}) };
        if (isTyping) {
          chatTyping[userId] = { userName, timestamp: Date.now() };
        } else {
          delete chatTyping[userId];
        }
        return {
          ...prev,
          [chatId]: chatTyping,
        };
      });
    });

    if (socket.connected) {
      socket.emit("join");
    }

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("users:online");
      socket.off("groups:update");
      socket.off("group:new");
      socket.off("group:updated");
      socket.off("group:deleted");
      socket.off("channels:update");
      socket.off("chat:states");
      socket.off("channel:new");
      socket.off("channel:updated");
      socket.off("channel:deleted");
      socket.off("channel:history:result");
      socket.off("channel:post:new");
      socket.off("channel:post:updated");
      socket.off("channel:comments:history:result");
      socket.off("channel:comment:new");
      socket.off("message:new");
      socket.off("message:updated");
      socket.off("message:deleted");
      socket.off("messages:read");
      socket.off("messages:delivered");
      socket.off("message:history:result");
      socket.off("message:edit:error");
      socket.off("profile:updated");
      socket.off("profile:update:error");
      socket.off("call:incoming");
      socket.off("call:accepted");
      socket.off("call:rejected");
      socket.off("call:ended");
      socket.off("call:signal");
      socket.off("group-call:joined");
      socket.off("group-call:state");
      socket.off("group-call:ended");
      socket.off("group-call:peer-left");
      socket.off("group-call:signal");
      socket.off("group-call:error");
      socket.off("typing:update");
      socket.off("auth:expired");
    };
  }, [user]);

  // Start typing / stop typing state syncing to others in active chat
  useEffect(() => {
    if (!messageText || !activeChat || !socket.connected) {
      if (isCurrentlyTypingRef.current && activeChat) {
        socket.emit("typing", { chatId: activeChat, isTyping: false });
        isCurrentlyTypingRef.current = false;
      }
      return;
    }

    if (!isCurrentlyTypingRef.current) {
      socket.emit("typing", { chatId: activeChat, isTyping: true });
      isCurrentlyTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isCurrentlyTypingRef.current && activeChatRef.current) {
        socket.emit("typing", {
          chatId: activeChatRef.current,
          isTyping: false,
        });
        isCurrentlyTypingRef.current = false;
      }
    }, 3000);
  }, [messageText, activeChat]);

  // Clean typing status when activeChat changes or on unmount
  useEffect(() => {
    return () => {
      if (isCurrentlyTypingRef.current && activeChatRef.current) {
        socket.emit("typing", {
          chatId: activeChatRef.current,
          isTyping: false,
        });
        isCurrentlyTypingRef.current = false;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [activeChat]);

  // Handle client-side periodic cleanup of stale typing indicators from other users
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      setTypingUsers((prev) => {
        const next = { ...prev };
        for (const chatId in next) {
          const chatTyping = { ...next[chatId] };
          let chatChanged = false;
          for (const userId in chatTyping) {
            if (now - chatTyping[userId].timestamp > 5000) {
              delete chatTyping[userId];
              chatChanged = true;
              changed = true;
            }
          }
          if (chatChanged) {
            if (Object.keys(chatTyping).length === 0) {
              delete next[chatId];
            } else {
              next[chatId] = chatTyping;
            }
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeChat) {
      const activeItem = [...groups, ...channels].find(i => i.id === activeChat);
      const isChannel = activeItem && 'isChannel' in activeItem && activeItem.isChannel;

      if (socket.connected) {
        if (isChannel) {
          socket.emit("channel:history", { channelId: activeChat });
        } else {
          socket.emit("message:history", { chatId: activeChat });
          socket.emit("message:read", { chatId: activeChat });
        }
      } else {
        import("./store/localDB").then((db) => {
          db.getMessagesLocally(activeChat).then((msgs) => {
            if (msgs.length > 0) setMessages(activeChat, msgs);
          });
        });
      }

      // Load draft
      import("./store/localDB").then((db) => {
        db.getDraftLocally(activeChat).then((draft) => {
          setMessageText(draft || "");
        });
      });
    } else {
      setMessageText("");
    }
  }, [activeChat, groups, channels, socket.connected]);

  useEffect(() => {
    if (activeChat && socket.connected) {
      const activeItem = channels.find(i => i.id === activeChat);
      if (activeItem) {
        const posts = useChatStore.getState().channelPosts[activeChat] || [];
        posts.forEach(post => {
          socket.emit("channel:post:view", { postId: post.id });
        });
      }
    }
  }, [activeChat, channels, socket.connected]);

  useEffect(() => {
    if (activeChat) {
      const timer = setTimeout(() => {
        import("./store/localDB").then((db) => {
          db.saveDraftLocally(activeChat, messageText);
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [messageText, activeChat]);

  // Removed messagesEndRef logic since we use virtualizer

  const applyAuthSession = (data: { token: string; user: User }) => {
    const previousUserId = getStoredUser()?.id || null;

    storeAuthSession(data);
    sessionExpiredDispatched = false;
    setSessionMessage(null);

    void import("./store/localDB").then(async (db) => {
      if (previousUserId && previousUserId !== data.user.id) {
        await db.clearLocalUserData(previousUserId);
      }
      db.setLocalDBUser(data.user.id);
    });
    useChatStore.setState({ chats: {}, channelPosts: {}, chatStates: {}, activeChat: null });
    setUser(data.user);
    connectSocket(data.token);
  };

  const handleAuth = async (
    authMode: "login" | "register",
    email: string,
    password: string,
    nickname: string,
    selectedColor: string,
    phoneNumber?: string,
  ) => {
    setLoading(true);
    setError(null);
    setSessionMessage(null);

    const isRegister = authMode === "register";

    let keyPair;

    try {
      // Lazy load E2EE if register
      if (isRegister) {
        const e2ee = await import("./utils/e2ee");
        keyPair = await e2ee.generateKeyPair();
        e2ee.saveLocalPrivateKey(keyPair.privateKey);
      }

      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = !isRegister
        ? { email, password }
        : {
            email,
            nickname,
            password,
            phoneNumber: phoneNumber?.trim() || undefined,
            avatarColor: selectedColor,
            publicKey: keyPair?.publicKey,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await readJsonResponse(res, "Authentication failed");
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      applyAuthSession(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (
    googleToken: { credential?: string; accessToken?: string },
    selectedColor: string,
  ) => {
    setLoading(true);
    setError(null);
    setSessionMessage(null);

    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...googleToken, avatarColor: selectedColor }),
      });

      const data = await readJsonResponse(res, "Google sign-in failed");
      if (!res.ok) throw new Error(data.error || "Google sign-in failed");

      applyAuthSession(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = (reason?: string) => {
    const token = getAuthToken();
    const userId = user?.id;
    if (token) {
      void import("./utils/pushNotifications")
        .then(({ disablePushNotifications }) => disablePushNotifications(token))
        .catch((error) => {
          console.warn("[PUSH] Failed to disable notifications:", error);
        });
    }
    if (userId) {
      void import("./store/localDB").then(async (db) => {
        await db.clearLocalUserData(userId);
        db.setLocalDBUser(null);
      });
    }
    clearAuthSession();
    sessionExpiredDispatched = false;
    if (reason) setSessionMessage(reason);
    setUser(null);
    useChatStore.setState({ chats: {}, channelPosts: {}, chatStates: {}, activeChat: null });
    socket.disconnect();
  };

  useEffect(() => {
    const onSessionExpired = () => {
      handleLogout("Сессия истекла. Войдите снова.");
    };
    window.addEventListener("nexa:session-expired", onSessionExpired);
    return () => window.removeEventListener("nexa:session-expired", onSessionExpired);
  }, []);

  useEffect(() => {
    const onNotify = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; type?: NotificationType }>).detail;
      if (detail?.message) notify(detail.message, detail.type || "error");
    };
    window.addEventListener("nexa:notify", onNotify);
    return () => window.removeEventListener("nexa:notify", onNotify);
  }, [notify]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !activeChat) return;

    const isChannel = [...groups, ...(useChatStore.getState().channels || [])].some(
      c => c.id === activeChat && (('isChannel' in c && c.isChannel) || (('isGroup' in c && c.name.includes('📢'))))
    );

    if (isChannel) {
      if (socket.connected) {
        socket.emit("channel:post:create", {
          channelId: activeChat,
          content: messageText,
        });
      }
      setMessageText("");
      return;
    }

    if (editingMessage) {
      if (socket.connected) {
        socket.emit("message:edit", {
          messageId: editingMessage.id,
          text: messageText,
        });
      }
      setMessageText("");
      setEditingMessage(null);
      return;
    }

    let payloadText = messageText;

    const recipient = getDirectChatUser(activeChat);

    if (E2EE_ENABLED && recipient && recipient.publicKey && user?.publicKey) {
      const PrivKeyE2EE = await import("./utils/e2ee");
      const privKey = await PrivKeyE2EE.getLocalPrivateKeyAsync();
      if (privKey) {
        const forRecipient = await PrivKeyE2EE.encryptMessage(
          messageText,
          recipient.publicKey,
          privKey,
        );
        const forSelf = await PrivKeyE2EE.encryptMessage(
          messageText,
          user.publicKey,
          privKey,
        );
        payloadText = `[E2EE]${JSON.stringify({ r: forRecipient, s: forSelf })}`;
      }
    }

    const msgPayload: any = {
      to: activeChat,
      text: payloadText,
      type: "text",
    };
    if (replyingTo) {
      msgPayload.replyToId = replyingTo.id;
    }

    const optMsg: Message = {
      id: "opt_" + Date.now(),
      from: user!,
      fromId: user!.id,
      toUserId: recipient ? activeChat : null,
      toGroupId: !recipient ? activeChat : null,
      text: payloadText,
      type: "text",
      timestamp: new Date(),
      status: "sending",
      replyToId: replyingTo ? replyingTo.id : null,
      replyTo: replyingTo,
    };
    addMessage(activeChat, optMsg);
    SoundUtility.playSendMessage();

    if (socket.connected) {
      socket.emit("message:send", msgPayload);
    } else {
      const localDB = await import("./store/localDB");
      await localDB.queueSyncAction({
        id: Date.now().toString(),
        type: "message:send",
        payload: msgPayload,
      });
    }
    setMessageText("");
    setReplyingTo(null);
  };

  const handleSendSticker = async (url: string) => {
    if (!activeChat) return;
    const recipient = getDirectChatUser(activeChat);
    const msgPayload = {
      to: activeChat,
      type: "sticker",
      data: url,
      text: "",
    };

    const optMsg: Message = {
      id: "opt_" + Date.now(),
      from: user!,
      fromId: user!.id,
      toUserId: recipient ? activeChat : null,
      toGroupId: !recipient ? activeChat : null,
      text: "",
      type: "sticker",
      data: url,
      timestamp: new Date(),
      status: "sending",
    };
    addMessage(activeChat, optMsg);
    SoundUtility.playSendMessage();

    if (socket.connected) {
      socket.emit("message:send", msgPayload);
    } else {
      const localDB = await import("./store/localDB");
      await localDB.queueSyncAction({
        id: Date.now().toString(),
        type: "message:send",
        payload: msgPayload,
      });
    }
    setShowEmojiPicker(false);
  };

  const handleSendVoiceSticker = async (url: string) => {
    if (!activeChat) return;
    const recipient = getDirectChatUser(activeChat);
    const msgPayload = {
      to: activeChat,
      type: "audio",
      data: url,
      text: "Voice Sticker",
    };

    const optMsg: Message = {
      id: "opt_" + Date.now(),
      from: user!,
      fromId: user!.id,
      toUserId: recipient ? activeChat : null,
      toGroupId: !recipient ? activeChat : null,
      text: "Voice Sticker",
      type: "audio",
      data: url,
      timestamp: new Date(),
      status: "sending",
    };
    addMessage(activeChat, optMsg);
    SoundUtility.playSendMessage();

    if (socket.connected) {
      socket.emit("message:send", msgPayload);
    } else {
      const localDB = await import("./store/localDB");
      await localDB.queueSyncAction({
        id: Date.now().toString(),
        type: "message:send",
        payload: msgPayload,
      });
    }
    setShowEmojiPicker(false);
  };

  const handleReplyToMessage = (msg: Message) => {
    setReplyingTo(msg);
  };

  const handleEditMessage = (msg: Message) => {
    if ((msg.text || "").startsWith("[E2EE]")) {
      notify("Зашифрованные сообщения пока нельзя редактировать", "warning");
      return;
    }
    setEditingMessage(msg);
    setReplyingTo(null);
    setMessageText(msg.text || "");
  };

  const handleDeleteChatMessage = (msg: Message) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      if (socket.connected) {
        socket.emit("message:delete", { messageId: msg.id });
      }
    }
  };

  const handleReactToMessage = (messageId: string, emoji: string) => {
    if (socket.connected) {
      const isChannel = [...groups, ...(useChatStore.getState().channels || [])].some(
        c => c.id === activeChat && (('isChannel' in c && c.isChannel) || (('isGroup' in c && c.name.includes('📢'))))
      );
      if (isChannel) {
        socket.emit("channel:post:react", { postId: messageId, emoji });
      } else {
        socket.emit("message:react", { messageId, emoji });
      }
    }
  };

  const toggleChannelComments = (postId: string) => {
    setExpandedCommentPostId((current) => {
      const next = current === postId ? null : postId;
      if (next && socket.connected && !channelComments[postId]) {
        socket.emit("channel:comments:history", { postId });
      }
      return next;
    });
  };

  const sendChannelComment = (postId: string) => {
    const text = (commentDrafts[postId] || "").trim();
    if (!text || !socket.connected) return;
    socket.emit("channel:comment:create", { postId, text });
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
  };

  const getPlaintextForForwarding = async (msg: Message): Promise<string> => {
    if (msg.type !== "text") return "";
    if (!msg.text?.startsWith("[E2EE]")) return msg.text || "";

    try {
      const e2ee = await import("./utils/e2ee");
      const rawJSON = msg.text.replace("[E2EE]", "");
      const parsed = JSON.parse(rawJSON);
      const privKey = await e2ee.getLocalPrivateKeyAsync();
      if (!privKey) return "[Зашифровано]";

      const isOutgoing = msg.fromId === user?.id;
      if (isOutgoing && user?.publicKey) {
        return await e2ee.decryptMessage(parsed.s, user.publicKey, privKey);
      } else {
        const senderUser =
          msg.from || onlineUsers.find((u) => u.id === msg.fromId) || user;
        if (senderUser?.publicKey) {
          return await e2ee.decryptMessage(
            parsed.r,
            senderUser.publicKey,
            privKey,
          );
        }
      }
    } catch (e) {
      console.error("Decryption failed for forwarding:", e);
    }
    return "[Ошибка расшифрования]";
  };

  const handleForwardTo = async (targetId: string) => {
    if (!forwardingMessage || !user) return;

    try {
      let msgText = forwardingMessage.text || "";
      if (forwardingMessage.type === "text") {
        const plaintext = await getPlaintextForForwarding(forwardingMessage);
        const senderNick = forwardingMessage.from?.nickname || "Неизвестно";
        msgText = `↪️ Переслано от @${senderNick}:\n${plaintext}`;
      }

      let payloadText = msgText;
      const recipient =
        getDirectChatUser(targetId);

      if (
        E2EE_ENABLED &&
        recipient &&
        recipient.publicKey &&
        user.publicKey &&
        forwardingMessage.type === "text"
      ) {
        const PrivKeyE2EE = await import("./utils/e2ee");
        const privKey = await PrivKeyE2EE.getLocalPrivateKeyAsync();
        if (privKey) {
          const forRecipient = await PrivKeyE2EE.encryptMessage(
            msgText,
            recipient.publicKey,
            privKey,
          );
          const forSelf = await PrivKeyE2EE.encryptMessage(
            msgText,
            user.publicKey,
            privKey,
          );
          payloadText = `[E2EE]${JSON.stringify({ r: forRecipient, s: forSelf })}`;
        }
      }

      const msgPayload: any = {
        to: targetId,
        text: payloadText,
        type: forwardingMessage.type,
      };

      if (forwardingMessage.data) {
        msgPayload.data = forwardingMessage.data;
      }

      const optMsg: Message = {
        id: "opt_" + Date.now(),
        from: user,
        fromId: user.id,
        toUserId: recipient ? targetId : null,
        toGroupId: !recipient ? targetId : null,
        text: payloadText,
        type: forwardingMessage.type,
        data: forwardingMessage.data,
        timestamp: new Date(),
        status: "sending",
      };

      addMessage(targetId, optMsg);
      SoundUtility.playSendMessage();

      if (socket.connected) {
        socket.emit("message:send", msgPayload);
      } else {
        const localDB = await import("./store/localDB");
        await localDB.queueSyncAction({
          id: Date.now().toString(),
          type: "message:send",
          payload: msgPayload,
        });
      }

      // Switch to target chat and close modal
      setActiveChat(targetId);
      setForwardingMessage(null);
    } catch (err) {
      console.error("Failed to forward message:", err);
      notify("Не удалось переслать сообщение");
    }
  };

  // Fetch all registered users in Nexa (excluding the current user)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          setAllUsers(data.filter((u: any) => u.id !== user.id));
        }
      } catch (err) {
        console.error("Failed to fetch all users:", err);
      }
    };
    fetchUsers();
  }, [user, setAllUsers]);

  const syncPhoneContactsWithNexa = async (contacts: ImportedPhoneContact[]) => {
    if (!contacts.length) return [];
    setContactsLoading(true);
    setContactsError(null);
    try {
      const res = await fetch("/api/contacts/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: contacts.map((contact) => ({
            id: contact.id,
            name: contact.name,
            phones: contact.phones,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Contacts sync failed");
      const nextContacts = (data.contacts || []) as ImportedPhoneContact[];
      setPhoneContacts(nextContacts);
      localStorage.setItem("nexa_phone_contacts", JSON.stringify(nextContacts));
      return nextContacts;
    } catch (err: any) {
      setContactsError(err.message || "Не удалось сверить контакты");
      return [];
    } finally {
      setContactsLoading(false);
    }
  };

  const importPhoneContacts = async () => {
    const contactsApi = (navigator as any).contacts;
    if (!contactsApi?.select) {
      setContactsError("На этом устройстве нет доступа к телефонной книге. Добавьте номера вручную ниже.");
      return;
    }

    try {
      const selected = await contactsApi.select(["name", "tel"], { multiple: true });
      const contacts = (selected || [])
        .map((contact: any, index: number) => {
          const name = Array.isArray(contact.name) ? contact.name[0] : contact.name;
          const phones = Array.isArray(contact.tel) ? contact.tel : [];
          return {
            id: `phone-${index}-${normalizePhoneForClient(phones[0]) || Date.now()}`,
            name: name || phones[0] || "Contact",
            phones,
          };
        })
        .filter((contact: ImportedPhoneContact) => contact.phones.length > 0);
      await syncPhoneContactsWithNexa(contacts);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setContactsError("Не удалось импортировать контакты");
      }
    }
  };

  const importManualContacts = async () => {
    const contacts = manualContactsText
      .split("\n")
      .map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const parts = trimmed.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
        const phone = parts.find((part) => normalizePhoneForClient(part)) || trimmed;
        const name = parts.length > 1 ? parts.find((part) => part !== phone) || phone : phone;
        return { id: `manual-${index}-${normalizePhoneForClient(phone)}`, name, phones: [phone] };
      })
      .filter(Boolean) as ImportedPhoneContact[];
    await syncPhoneContactsWithNexa(contacts);
  };

  const invitePhoneContact = async (contact: ImportedPhoneContact) => {
    const url = window.location.origin;
    const text = `${inviteText}${url}`;
    const phone = contact.phones[0];
    if ((navigator as any).share) {
      await (navigator as any).share({ title: "NEXA Messenger", text, url }).catch(() => {});
      return;
    }
    if (phone && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      window.location.href = `sms:${phone}?body=${encodeURIComponent(text)}`;
      return;
    }
    await navigator.clipboard?.writeText(text);
    notify("Ссылка приглашения скопирована", "success");
  };

  const onCreateGroup = (data: any) => {
    socket.emit("group:create", data);
    setShowGroupModal(false);
  };

  const onCreateChannel = (data: any) => {
    socket.emit("channel:create", data);
    setShowChannelModal(false);
  };

  const handleChatAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatItem || !("isGroup" in activeChatItem || "isChannel" in activeChatItem)) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const isChannel = "isChannel" in activeChatItem && activeChatItem.isChannel;
      socket.emit(isChannel ? "channel:update" : "group:update", {
        id: activeChatItem.id,
        name: activeChatItem.name,
        avatarImage: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const fetchAdminStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setAdminStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminGroups = async () => {
    try {
      const res = await fetch("/api/admin/groups");
      if (res.ok) {
        const data = await res.json();
        setAdminGroups(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminMessages = async () => {
    try {
      const res = await fetch("/api/admin/messages");
      if (res.ok) {
        const data = await res.json();
        setAdminMessages(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleUserRole = async (
    targetUserId: string,
    currentRole: string,
  ) => {
    try {
      const newRole = currentRole === "admin" ? "user" : "admin";
      const res = await fetch(`/api/admin/users/${targetUserId}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        fetchAdminUsers();
        fetchAdminStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (targetUserId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? All their messages and group memberships will be deleted.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAdminUsers();
        fetchAdminStats();
      } else {
        const data = await res.json();
        notify(data.error || "Failed to delete user");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this group? All associated messages and memberships will be deleted.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/groups/${groupId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAdminGroups();
        fetchAdminStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      const res = await fetch(`/api/admin/messages/${msgId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAdminMessages();
        fetchAdminStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showAdminPanel && user?.role === "admin") {
      if (adminTab === "stats") fetchAdminStats();
      if (adminTab === "users") fetchAdminUsers();
      if (adminTab === "groups") fetchAdminGroups();
      if (adminTab === "messages") fetchAdminMessages();
    }
  }, [showAdminPanel, adminTab, user]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (activeChat) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!activeChat) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file, file.name, activeChat);
  };

  const savedMessagesChatItem: User | null = user && activeChat === user.id
    ? { ...user, nickname: "Избранное", status: "online" }
    : null;
  const activeChatItem = savedMessagesChatItem || [...onlineUsers, ...groups, ...channels, ...allUsers].find(
    (i) => i.id === activeChat,
  );
  const isChannelChat = activeChatItem && 'isChannel' in activeChatItem && activeChatItem.isChannel;
  const isGroupChat = !!activeChatItem && "isGroup" in activeChatItem && activeChatItem.isGroup;
  const isDirectChat = !!activeChatItem && !("members" in activeChatItem);
  const isActiveChatOnline = isDirectChat && (activeChatItem?.id === user?.id || onlineUsers.some((onlineUser) => onlineUser.id === activeChatItem?.id));
  const isCurrentGroupCall = !!activeChat && groupCall.groupId === activeChat && groupCall.status !== "idle";
  const currentGroupCallParticipants = activeChat ? (activeGroupCalls[activeChat] || (isCurrentGroupCall ? groupCall.participants : [])) : [];
  const isGroupCallAvailable = currentGroupCallParticipants.length > 0;
  const activeChatClearedAt = activeChat ? (chatClearedAt[activeChat] || 0) : 0;
  const isActiveMessageVisible = (message: Message) => {
    if (!activeChatClearedAt) return true;
    const messageTime = new Date(message.timestamp).getTime();
    return Number.isNaN(messageTime) || messageTime > activeChatClearedAt;
  };
  const activeMessages = (activeChat 
    ? (isChannelChat 
        ? (useChatStore.getState().channelPosts[activeChat] || []).map((p: ChannelPost) => {
            const attachments = parseChannelAttachments(p.attachments);
            const primaryAttachment = attachments[0];
            const mediaType = primaryAttachment?.type || (primaryAttachment?.url ? 'image' : 'text');
            const mappedType = mediaType === 'audio' || mediaType === 'video' || mediaType === 'image'
              ? mediaType
              : primaryAttachment?.url
                ? 'image'
                : 'text';
            return {
              id: p.id,
              fromId: p.authorId,
              text: p.content || '',
              type: mappedType,
              data: primaryAttachment?.url,
              timestamp: p.createdAt,
              from: p.author,
              isChannelPost: true,
              views: p.views,
              reactions: p.reactions,
              commentsCount: p.commentsCount ?? p.comments?.length ?? 0,
            } as any;
          }) 
        : (chats[activeChat]?.messages || [])) 
    : []).filter(isActiveMessageVisible);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: activeMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  const isMessageScrollerNearBottom = useCallback(() => {
    const scroller = parentRef.current;
    if (!scroller) return true;
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
  }, []);

  const scrollToLatestMessage = useCallback(() => {
    if (!activeMessages.length) return;
    virtualizer.scrollToIndex(activeMessages.length - 1, { align: "end" });
    setShowScrollToBottom(false);
  }, [activeMessages.length, virtualizer]);

  useEffect(() => {
    if (activeMessages.length) {
      scrollToLatestMessage();
    }
  }, [activeChat, scrollToLatestMessage]);

  useEffect(() => {
    if (!activeMessages.length) {
      setShowScrollToBottom(false);
      return;
    }
    if (isMessageScrollerNearBottom()) {
      scrollToLatestMessage();
    }
  }, [activeMessages.length, isMessageScrollerNearBottom, scrollToLatestMessage]);

  useEffect(() => {
    const scroller = parentRef.current;
    if (!scroller) return;

    const updateScrollButton = () => {
      setShowScrollToBottom(!isMessageScrollerNearBottom());
    };

    updateScrollButton();
    scroller.addEventListener("scroll", updateScrollButton, { passive: true });
    return () => scroller.removeEventListener("scroll", updateScrollButton);
  }, [activeChat, activeMessages.length, isMessageScrollerNearBottom]);

  const getTypingIndicatorText = () => {
    if (!activeChat) return null;
    const activeChatTypers = typingUsers[activeChat];
    if (!activeChatTypers) return null;

    const typersList = Object.values(activeChatTypers)
      .map((t) => t.userName)
      .filter(Boolean);
    if (typersList.length === 0) return null;

    if (typersList.length === 1) {
      return `${typersList[0]} печатает...`;
    } else if (typersList.length === 2) {
      return `${typersList[0]} и ${typersList[1]} печатают...`;
    } else {
      return `Несколько человек печатают...`;
    }
  };

  const typingText = getTypingIndicatorText();

  if (!user) {
    return (
      <>
        <LaunchSplash />
        <Suspense fallback={null}>
        <AuthPage onAuth={handleAuth} onGoogleAuth={handleGoogleAuth} loading={loading} error={error || sessionMessage} />
        </Suspense>
      </>
    );
  }

  return (
    <MainLayout
      setShowAdminPanel={setShowAdminPanel}
      setShowGroupModal={setShowGroupModal}
      setShowMenuDrawer={setShowMenuDrawer}
      setShowCallsModal={setShowCallsModal}
      setShowContactsModal={setShowContactsModal}
      showContactsEntry={showContactsEntry}
    >
      <LaunchSplash />
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
      <main 
        className={`chat-area ${!activeChat ? "mobile-hidden" : ""} ${chatWallpaper ? "has-wallpaper" : ""}`}
        style={{ backgroundImage: chatWallpaper ? `url(${chatWallpaper})` : 'none', position: 'relative', overflow: 'hidden' }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: chatWallpaper ? 0.08 : 0.12,
            color: 'rgba(255,255,255,0.75)',
            fontSize: '24px',
            lineHeight: '3.8rem',
            letterSpacing: '0.85rem',
            transform: 'rotate(-7deg) scale(1.05)',
            transformOrigin: 'center',
            display: 'grid',
            placeItems: 'center',
            zIndex: 0,
            userSelect: 'none',
            mixBlendMode: 'soft-light',
          }}
        >
          <div style={{ width: '140%', maxWidth: '1200px', textAlign: 'center', whiteSpace: 'normal' }}>
            {'✦  ◦  ⟡  ◦  ✦  ◦  ⟡  ◦  ✦  ◦  ⟡  ◦  '.repeat(18)}
          </div>
        </div>
        {!activeChat ? (
          <div className="empty-chat active" style={{ position: 'relative', zIndex: 1 }}>
            <div className="flex flex-col items-center justify-center mb-6">
              <NexaLogo
                size={110}
                showText={true}
                tagline="СЕТЬ БЕЗОПАСНОЙ СВЯЗИ"
              />
            </div>
            <h3>Выберите собеседника</h3>
            <p>Зашифрованные сообщения только для ваших глаз.</p>
          </div>
        ) : (
          <div
            className="chat-container active"
            style={{ position: 'relative', zIndex: 1 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="drag-overlay">
                <div className="drag-content border-2 border-dashed border-[#00efff] p-12 rounded-xl flex flex-col items-center justify-center bg-[rgba(0,0,0,0.8)] z-50 absolute inset-0 text-[#00efff]">
                  <Paperclip size={48} />
                  <h2 className="mt-4 font-bold tracking-widest uppercase">
                    Перетащите файлы для отправки
                  </h2>
                </div>
              </div>
            )}
            <header className="chat-header">
              <div className="chat-info">
                <button
                  className="desktop-back-btn"
                  onClick={() => setActiveChat(null)}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    color: "var(--accent-color)",
                    marginRight: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                    padding: "6px 12px 6px 6px",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.1)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.05)")
                  }
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    Назад
                  </span>
                </button>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {activeChatItem && ("isGroup" in activeChatItem || "isChannel" in activeChatItem) ? (
                    <div
                      className="avatar avatar-hover-edit"
                      style={{
                        backgroundColor: activeChatItem?.avatarColor,
                        backgroundImage: activeChatItem?.avatarImage
                          ? `url(${activeChatItem?.avatarImage})`
                          : "none",
                        width: 40,
                        height: 40,
                        position: "relative",
                        cursor: "pointer",
                        overflow: "hidden",
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        groupAvatarInputRef.current?.click();
                      }}
                      title="Нажмите, чтобы изменить аватар группы"
                    >
                      {!activeChatItem?.avatarImage &&
                        ((activeChatItem && "initials" in activeChatItem
                          ? activeChatItem.initials
                          : null) ||
                          getInitials(
                            activeChatItem && "name" in activeChatItem
                              ? activeChatItem.name
                              : (activeChatItem as any)?.nickname || "?",
                          ))}
                      <div
                        className="avatar-edit-icon-overlay"
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0, 0, 0, 0.6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0,
                          transition: "opacity 0.2s ease",
                          color: "#ffffff",
                        }}
                      >
                        <Camera size={16} />
                      </div>
                      <input
                        type="file"
                        ref={groupAvatarInputRef}
                        onChange={handleChatAvatarChange}
                        accept="image/*"
                        style={{ display: "none" }}
                      />
                    </div>
                  ) : (
                    <div
                      className="avatar"
                      style={{
                        backgroundColor: activeChatItem?.avatarColor,
                        backgroundImage: activeChatItem?.avatarImage
                          ? `url(${activeChatItem?.avatarImage})`
                          : "none",
                        width: 40,
                        height: 40,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      onClick={() => {
                        setProfileItem(activeChatItem || null);
                        setShowProfile(true);
                      }}
                    >
                      {!activeChatItem?.avatarImage &&
                        ((activeChatItem && "initials" in activeChatItem
                          ? activeChatItem.initials
                          : null) ||
                          getInitials(
                            activeChatItem && "name" in activeChatItem
                              ? activeChatItem.name
                              : (activeChatItem as any)?.nickname || "?",
                          ))}
                    </div>
                  )}
                  <div
                    onClick={() => {
                      setProfileItem(activeChatItem || null);
                      setShowProfile(true);
                    }}
                    style={{ marginLeft: "12px", cursor: "pointer" }}
                  >
                    <h2>
                      {activeChatItem && "name" in activeChatItem
                        ? activeChatItem.name
                        : (activeChatItem as any)?.nickname || "Unknown"}
                    </h2>
                    {typingText ? (
                      <div className="typing-indicator">
                        <span className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </span>
                        <span>{typingText}</span>
                      </div>
                    ) : activeChatItem && "members" in activeChatItem ? (
                      <div
                        className="online-indicator"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {activeChatItem.members.length}{" "}
                        {activeChatItem.name.includes("📢")
                          ? "подписчиков"
                          : "участников"}
                      </div>
                    ) : (
                      <div className={`online-indicator ${isActiveChatOnline ? "" : "offline"}`}>
                        {isActiveChatOnline ? "В сети" : "Не в сети"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div
                className="chat-actions"
                style={{ display: "flex", gap: "8px" }}
              >
                {activeChatItem && !("members" in activeChatItem) && activeChatItem.id !== user.id && (
                  <>
                    <button
                      title="Голосовой звонок"
                      onClick={() => handleInitiateCall("audio")}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent-color)",
                        cursor: "pointer",
                        padding: "8px",
                        display: "flex",
                        alignItems: "center",
                        transition: "transform 0.2s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.transform = "scale(1.15)")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.transform = "scale(1)")
                      }
                    >
                      <Phone size={20} />
                    </button>
                    <button
                      title="Видеозвонок"
                      onClick={() => handleInitiateCall("video")}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent-color)",
                        cursor: "pointer",
                        padding: "8px",
                        display: "flex",
                        alignItems: "center",
                        transition: "transform 0.2s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.transform = "scale(1.15)")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.transform = "scale(1)")
                      }
                    >
                      <Video size={20} />
                    </button>
                  </>
                )}
                {activeChat && isGroupChat && (
                  <button
                    title={isCurrentGroupCall ? "Выйти из группового звонка" : "Войти в групповой звонок"}
                    onClick={() => {
                      if (isCurrentGroupCall) {
                        handleLeaveGroupCall();
                      } else {
                        void handleJoinGroupCall(activeChat);
                      }
                    }}
                    style={{
                      background: isCurrentGroupCall ? "rgba(239, 68, 68, 0.16)" : "rgba(0, 239, 255, 0.1)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "12px",
                      color: isCurrentGroupCall ? "#ff6b6b" : "var(--accent-color)",
                      cursor: "pointer",
                      padding: "8px",
                      display: "flex",
                      alignItems: "center",
                      transition: "transform 0.2s",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.transform = "scale(1.08)")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                  >
                    {isCurrentGroupCall ? <PhoneOff size={20} /> : <PhoneCall size={20} />}
                  </button>
                )}
              </div>
            </header>

            {activeChat && isGroupChat && (isGroupCallAvailable || isCurrentGroupCall) && (
              <section className={`group-call-stage ${isCurrentGroupCall ? "joined" : ""}`}>
                <div className="group-call-stage-header">
                  <div className="group-call-stage-title">
                    <div
                      className="group-call-stage-avatar"
                      style={{
                        backgroundColor: activeChatItem?.avatarColor,
                        backgroundImage: activeChatItem?.avatarImage ? `url(${activeChatItem.avatarImage})` : "none",
                      }}
                    >
                      {!activeChatItem?.avatarImage &&
                        ((activeChatItem && "initials" in activeChatItem ? activeChatItem.initials : null) ||
                          getInitials(activeChatItem && "name" in activeChatItem ? activeChatItem.name : "G"))}
                    </div>
                    <div>
                      <span className="group-call-eyebrow">Групповой звонок</span>
                      <h3>{activeChatItem && "name" in activeChatItem ? activeChatItem.name : "Группа"}</h3>
                      <p>
                        {isCurrentGroupCall
                          ? `${currentGroupCallParticipants.length} участников • ${formatDuration(groupCall.duration)}`
                          : `${currentGroupCallParticipants.length} участников уже говорят`}
                      </p>
                    </div>
                  </div>
                  <div className="group-call-stage-tools">
                    <button type="button" title="Участники">
                      <Users size={18} />
                    </button>
                    <button type="button" title="Голосовой канал">
                      <PhoneCall size={18} />
                    </button>
                  </div>
                </div>

                <div className={`group-call-grid count-${Math.min(currentGroupCallParticipants.length, 6)}`}>
                  {currentGroupCallParticipants.map((participant) => {
                    const isSelf = participant.userId === user?.id;
                    const participantName = isSelf ? "Вы" : participant.user.nickname;
                    return (
                      <div
                        className={`group-call-tile ${participant.muted ? "muted" : "speaking"}`}
                        key={participant.userId}
                        style={{ backgroundColor: participant.user.avatarColor || "#1f1f24" }}
                      >
                        <div
                          className="group-call-tile-avatar"
                          style={{
                            backgroundColor: participant.user.avatarColor,
                            backgroundImage: participant.user.avatarImage ? `url(${participant.user.avatarImage})` : "none",
                          }}
                        >
                          {!participant.user.avatarImage &&
                            (participant.user.initials || getInitials(participant.user.nickname))}
                        </div>
                        <div className="group-call-nameplate">
                          {participant.muted ? <MicOff size={15} /> : <Mic size={15} />}
                          <span>{participantName}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="group-call-dock">
                  {isCurrentGroupCall && (
                    <button
                      type="button"
                      className={`group-call-round-btn ${groupCall.isMuted ? "active" : ""}`}
                      onClick={handleToggleGroupMute}
                      title={groupCall.isMuted ? "Включить микрофон" : "Выключить микрофон"}
                    >
                      {groupCall.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`group-call-round-btn primary ${isCurrentGroupCall ? "danger" : ""}`}
                    onClick={() => {
                      if (isCurrentGroupCall) {
                        handleLeaveGroupCall();
                      } else {
                        void handleJoinGroupCall(activeChat);
                      }
                    }}
                    title={isCurrentGroupCall ? "Отключиться" : "Подключиться"}
                  >
                    {isCurrentGroupCall ? <PhoneOff size={22} /> : <PhoneCall size={22} />}
                  </button>
                </div>
              </section>
            )}

            <div className="messages" ref={parentRef}>
              <div
                className="messages-virtual-canvas"
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const msg = activeMessages[virtualItem.index];
                  const isOutgoing = msg.fromId === user.id;
                  const isGroupChat =
                    activeChatItem && "isGroup" in activeChatItem;
                  const senderUser =
                    msg.from ||
                    onlineUsers.find((u) => u.id === msg.fromId) ||
                    allUsers.find((u) => u.id === msg.fromId) ||
                    user;

                  const displayText = (
                    <DecryptedText
                      text={msg.text || ""}
                      isGroupChat={!!isGroupChat}
                      isOutgoing={isOutgoing}
                      userPublicKey={user?.publicKey}
                      senderPublicKey={senderUser?.publicKey}
                      showLockIcon={true}
                    />
                  );
                  return (
                    <div
                      className="messages-virtual-item"
                      key={virtualItem.key}
                      data-index={virtualItem.index}
                      ref={virtualizer.measureElement}
                      style={{
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <MessageBubble
                        msg={msg}
                        isOutgoing={isOutgoing}
                        isGroupChat={!!isGroupChat}
                        displayText={displayText || ""}
                        senderUser={senderUser}
                        currentUser={user}
                        onReply={handleReplyToMessage}
                        onReact={handleReactToMessage}
                        senderNameOverride={
                          isGroupChat &&
                          msg.fromId === (activeChatItem as any).creatorId
                            ? "Владелец"
                            : undefined
                        }
                        groupCreatorId={
                          isGroupChat
                            ? (activeChatItem as any).creatorId
                            : undefined
                        }
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteChatMessage}
                        isGroupOwner={
                          isGroupChat &&
                          (activeChatItem as any).creatorId === user?.id
                        }
                        isGroupCoOwner={
                          isGroupChat &&
                          (activeChatItem as any).members?.some(
                            (m: any) =>
                              m.userId === user?.id && m.isCoOwner === true,
                          )
                        }
                        onForward={setForwardingMessage}
                      />
                      {(msg as any).isChannelPost && (
                        <div className="channel-comments-panel">
                          <button
                            type="button"
                            className="channel-comments-toggle"
                            onClick={() => toggleChannelComments(msg.id)}
                          >
                            <MessageCircle size={15} />
                            <span>
                              {((msg as any).commentsCount || 0) > 0
                                ? `${(msg as any).commentsCount} комментариев`
                                : "Комментировать"}
                            </span>
                          </button>

                          {expandedCommentPostId === msg.id && (
                            <div className="channel-comments-thread">
                              {(channelComments[msg.id] || []).length > 0 ? (
                                <div className="channel-comments-list">
                                  {(channelComments[msg.id] || []).map((comment) => (
                                    <div key={comment.id} className="channel-comment-item">
                                      <div
                                        className="avatar channel-comment-avatar"
                                        style={{
                                          backgroundColor: comment.author.avatarColor,
                                          backgroundImage: comment.author.avatarImage ? `url(${comment.author.avatarImage})` : "none",
                                        }}
                                      >
                                        {!comment.author.avatarImage && comment.author.initials}
                                      </div>
                                      <div className="channel-comment-body">
                                        <div className="channel-comment-meta">
                                          <span>{comment.author.nickname}</span>
                                          <small>{new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                                        </div>
                                        <p>{comment.text}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="channel-comments-empty">Комментариев пока нет</div>
                              )}

                              <div className="channel-comment-compose">
                                <input
                                  type="text"
                                  value={commentDrafts[msg.id] || ""}
                                  placeholder="Добавить комментарий..."
                                  onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [msg.id]: event.target.value }))}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      sendChannelComment(msg.id);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => sendChannelComment(msg.id)}
                                  disabled={!(commentDrafts[msg.id] || "").trim()}
                                >
                                  <Send size={15} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {showScrollToBottom && activeMessages.length > 0 && (
              <button
                type="button"
                className="scroll-to-bottom-button"
                title="К новым сообщениям"
                aria-label="К новым сообщениям"
                onClick={scrollToLatestMessage}
              >
                <ArrowDown size={20} />
              </button>
            )}

            <div className="input-area">
              {isRecording && (
                <div className="recording-status">
                  <div className="recording-dot"></div>
                  <span>
                    Recording: {Math.floor(recordingDuration / 60)}:
                    {(recordingDuration % 60).toString().padStart(2, "0")}
                  </span>
                  <button onClick={stopRecording} className="btn-stop-rec">
                    Stop
                  </button>
                </div>
              )}
              {isVideoRecording && (
                <div className="video-recording-status">
                  <div className="video-recording-preview">
                    <video
                      ref={videoRecordingPreviewRef}
                      autoPlay
                      muted
                      playsInline
                    />
                    <span className="video-recording-pulse" />
                  </div>
                  <div className="video-recording-meta">
                    <span className="video-recording-title">Видео</span>
                    <span className="video-recording-time">
                      {Math.floor(videoRecordingDuration / 60)}:
                      {(videoRecordingDuration % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <button type="button" onClick={cancelVideoNoteRecording} className="btn-video-rec cancel">
                    <X size={16} />
                  </button>
                  <button type="button" onClick={stopVideoNoteRecording} className="btn-video-rec send">
                    <Send size={16} />
                  </button>
                </div>
              )}
              <div
                className={`emoji-picker ${showEmojiPicker ? "active" : ""}`}
              >
                <div className="picker-tabs">
                  <button
                    className={`picker-tab ${pickerType === "emoji" ? "active" : ""}`}
                    onClick={() => setPickerType("emoji")}
                  >
                    😀
                  </button>
                  <button
                    className={`picker-tab ${pickerType === "sticker" ? "active" : ""}`}
                    onClick={() => setPickerType("sticker")}
                  >
                    ✨
                  </button>
                  <button
                    className={`picker-tab ${pickerType === "voice" ? "active" : ""}`}
                    onClick={() => setPickerType("voice")}
                  >
                    🔊
                  </button>
                </div>
                <div
                  className={`picker-content ${pickerType !== "emoji" ? "stickers" : ""}`}
                >
                  {pickerType === "emoji"
                    ? EMOJIS.map((e) => (
                        <span
                          key={e}
                          className="emoji-item"
                          onClick={() => setMessageText((prev) => prev + e)}
                        >
                          {e}
                        </span>
                      ))
                    : pickerType === "sticker"
                      ? STICKERS.map((s) => (
                          <div
                            key={s.name}
                            className="sticker-item"
                            onClick={() => handleSendSticker(s.url)}
                          >
                            <img src={s.url} alt={s.name} />
                          </div>
                        ))
                      : VOICE_STICKERS.map((vs) => (
                          <div
                            key={vs.name}
                            className="voice-sticker-item"
                            onClick={() => handleSendVoiceSticker(vs.url)}
                          >
                            <span>{vs.name}</span>
                            <Mic size={14} />
                          </div>
                        ))}
                </div>
              </div>

              {replyingTo && (
                <div className="reply-preview-container">
                  <div className="reply-preview-content">
                    <span
                      className="reply-preview-sender"
                      style={{ color: replyingTo.from?.avatarColor }}
                    >
                      Ответ для {replyingTo.from?.nickname || "Неизвестно"}
                    </span>
                    <span className="reply-preview-text">
                      {replyingTo.type === "text"
                        ? replyingTo.text
                        : `[${replyingTo.type.charAt(0).toUpperCase() + replyingTo.type.slice(1)}]`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-close-reply"
                    onClick={() => setReplyingTo(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {editingMessage && (
                <div
                  className="reply-preview-container"
                  style={{ borderLeftColor: "#c084fc" }}
                >
                  <div className="reply-preview-content">
                    <span
                      className="reply-preview-sender"
                      style={{ color: "#c084fc" }}
                    >
                      Редактирование сообщения
                    </span>
                    <span className="reply-preview-text">
                      {editingMessage.text}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-close-reply"
                    onClick={() => {
                      setEditingMessage(null);
                      setMessageText("");
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {(() => {
                const isRealChannel = activeChatItem && 'isChannel' in activeChatItem && activeChatItem.isChannel;
                const isLegacyChannel =
                  activeChatItem &&
                  "isGroup" in activeChatItem &&
                  activeChatItem.name.includes("📢");
                const isChannel = isRealChannel || isLegacyChannel;

                const isRestrictedInChannel =
                  isChannel &&
                  (() => {
                    if (isRealChannel && activeChatItem) {
                      if ((activeChatItem as any).ownerId === user.id) return false;
                      const isOwnerOrAdmin = (activeChatItem as any).members?.some(
                        (m: any) => m.userId === user.id && (m.role === 'owner' || m.role === 'admin')
                      );
                      return !isOwnerOrAdmin;
                    }
                    if (isLegacyChannel && activeChatItem && 'creatorId' in activeChatItem) {
                      if (activeChatItem.creatorId === user.id) return false;
                      const isCoOwner = activeChatItem.members?.some(
                        (m: any) => m.userId === user.id && m.isCoOwner === true,
                      );
                      return !isCoOwner;
                    }
                    return false;
                  })();

                if (isRestrictedInChannel) {
                  return (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "16px",
                        background: "rgba(255, 255, 255, 0.02)",
                        borderRadius: "12px",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-secondary)",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Lock size={15} /> Только владельцы и совладельцы могут
                        писать в этот канал
                      </span>
                    </div>
                  );
                }

                return (
                  <form className="input-wrapper" onSubmit={handleSendMessage}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      title="Прикрепить"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip size={20} />
                    </button>
                    <button
                      type="button"
                      title="Смайлики"
                      className={showEmojiPicker ? "active" : ""}
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                      <Smile size={20} />
                    </button>
                    <input
                      type="text"
                      placeholder={
                        isRecording || isVideoRecording ? "Идет запись..." : "Введите сообщение..."
                      }
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      disabled={isRecording || isVideoRecording}
                    />
                    {messageText.trim() ? (
                      <button type="submit" className="send-btn">
                        <Send size={18} />
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className={`voice-btn ${isVideoRecording ? "recording" : ""}`}
                          onClick={isVideoRecording ? stopVideoNoteRecording : startVideoNoteRecording}
                          title="Видео сообщение"
                        >
                          <Video size={18} />
                        </button>
                        <button
                          type="button"
                          className={`voice-btn ${isRecording ? "recording" : ""}`}
                          onClick={isRecording ? stopRecording : startRecording}
                          title="Голосовое сообщение"
                        >
                          <Mic size={18} />
                        </button>
                      </div>
                    )}
                  </form>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showGroupModal && (
        <Suspense fallback={null}>
          <CreateGroupModal
            onClose={() => setShowGroupModal(false)}
            onlineUsers={allUsers.filter((u) => u.id !== user.id)}
            handleCreateGroup={onCreateGroup}
          />
        </Suspense>
      )}

      {showMyProfile && user && (
        <Suspense fallback={null}>
          <MyProfileModal
            onClose={() => setShowMyProfile(false)}
            user={user}
            onUpdate={(updatedData) => {
              socket.emit("profile:update", updatedData);
            }}
            handleLogout={handleLogout}
          />
        </Suspense>
      )}

      {showProfile && profileItem && (
        <Suspense fallback={null}>
          <ProfileModal
            onClose={() => setShowProfile(false)}
            profileItem={profileItem}
            onlineUsers={onlineUsers}
            socket={socket}
            currentUser={user}
          />
        </Suspense>
      )}

      {showAdminPanel && user?.role === "admin" && (
        <Suspense fallback={null}>
          <AdminPanel
            onClose={() => setShowAdminPanel(false)}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            adminStats={adminStats}
            adminUsers={adminUsers}
            adminGroups={adminGroups}
            adminMessages={adminMessages}
            currentUser={user}
            handleToggleUserRole={handleToggleUserRole}
            handleDeleteUser={handleDeleteUser}
            handleDeleteGroup={handleDeleteGroup}
            handleDeleteMessage={handleDeleteMessage}
          />
        </Suspense>
      )}

      {/* ==========================================================================
         COMPETITOR SLIDING MENU DRAWER (Telegram Style)
         ========================================================================== */}
      <div
        className={`menu-drawer-backdrop ${showMenuDrawer ? "active" : ""}`}
        onClick={() => setShowMenuDrawer(false)}
      >
        <div className="menu-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="menu-drawer-user-info">
            <div
              className="avatar"
              style={{
                backgroundColor: user.avatarColor,
                backgroundImage: user.avatarImage
                  ? `url(${user.avatarImage})`
                  : "none",
                width: 60,
                height: 60,
                fontSize: "20px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                color: "white",
                border: "2px solid var(--accent-color)",
              }}
            >
              {!user.avatarImage &&
                (user.initials || getInitials(user.nickname))}
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                @{user.nickname}
              </h3>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                }}
              >
                {user.email}
              </p>
            </div>
          </div>

          <div className="menu-drawer-items">
            <div
              className="menu-drawer-item"
              onClick={() => {
                setShowMenuDrawer(false);
                setShowMyProfile(true);
              }}
            >
              <div className="menu-drawer-item-left">
                <Users size={18} className="menu-drawer-item-icon" />
                <span>Профиль и настройки</span>
              </div>
            </div>

            {/* Внешний вид */}
            <div className="menu-drawer-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '12px 20px', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Внешний вид</span>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveTheme('cosmic'); localStorage.setItem('nexa_theme', 'cosmic'); }}
                  style={{ flex: 1, padding: '6px', fontSize: '11px', borderRadius: '8px', background: activeTheme === 'cosmic' ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)', color: activeTheme === 'cosmic' ? '#000' : 'var(--text-primary)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >Космос</button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveTheme('cyberpunk'); localStorage.setItem('nexa_theme', 'cyberpunk'); }}
                  style={{ flex: 1, padding: '6px', fontSize: '11px', borderRadius: '8px', background: activeTheme === 'cyberpunk' ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)', color: activeTheme === 'cyberpunk' ? '#000' : 'var(--text-primary)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >Кибер</button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveTheme('ocean'); localStorage.setItem('nexa_theme', 'ocean'); }}
                  style={{ flex: 1, padding: '6px', fontSize: '11px', borderRadius: '8px', background: activeTheme === 'ocean' ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)', color: activeTheme === 'ocean' ? '#000' : 'var(--text-primary)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >Океан</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', marginTop: '4px' }}>
                 <span style={{ fontSize: '0.9rem' }}>Обои чата</span>
                 <div style={{ display: 'flex', gap: '4px' }}>
                   {chatWallpaper && (
                     <button onClick={handleResetChatWallpaper} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>Сброс</button>
                   )}
                   <button onClick={(e) => {
                      e.stopPropagation();
                      chatWallpaperInputRef.current?.click();
                   }} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>Изменить</button>
                   <input type="file" accept="image/*" ref={chatWallpaperInputRef} style={{ display: 'none' }} onChange={handleChatWallpaperChange} />
                 </div>
              </div>
            </div>

            <div
              className="menu-drawer-item"
              onClick={() => {
                setShowMenuDrawer(false);
                setShowWalletModal(true);
              }}
            >
              <div className="menu-drawer-item-left">
                <Wallet
                  size={18}
                  className="menu-drawer-item-icon"
                  style={{ color: "var(--accent-color)" }}
                />
                <span>Оплата</span>
              </div>
              <span
                style={{
                  fontSize: "0.75rem",
                  background: "rgba(0, 255, 204, 0.1)",
                  color: "var(--accent-color)",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontWeight: 600,
                }}
              >
                {walletBalance} N
              </span>
            </div>

            <div
              className="menu-drawer-item"
              onClick={() => {
                setShowMenuDrawer(false);
                setShowGroupModal(true);
              }}
            >
              <div className="menu-drawer-item-left">
                <Plus size={18} className="menu-drawer-item-icon" />
                <span>Создать группу</span>
              </div>
            </div>

            <div
              className="menu-drawer-item"
              onClick={() => {
                setShowMenuDrawer(false);
                setShowChannelModal(true);
              }}
            >
              <div className="menu-drawer-item-left">
                <Shield size={18} className="menu-drawer-item-icon" />
                <span>Создать канал</span>
              </div>
              <span
                style={{
                  fontSize: "0.65rem",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-secondary)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                NEW
              </span>
            </div>

            {showContactsEntry && (
              <div
                className="menu-drawer-item"
                onClick={() => {
                  setShowMenuDrawer(false);
                  setShowContactsModal(true);
                }}
              >
                <div className="menu-drawer-item-left">
                  <Users size={18} className="menu-drawer-item-icon" />
                  <span>Контакты</span>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "var(--text-secondary)",
                    padding: "1px 6px",
                    borderRadius: "10px",
                  }}
                >
                  {
                    onlineUsers.filter(
                      (u) =>
                        (chats[u.id]?.messages &&
                          chats[u.id].messages.length > 0) ||
                        u.id === activeChat ||
                        u.id === user.id,
                    ).length
                  }
                </span>
              </div>
            )}

            <div
              className="menu-drawer-item"
              onClick={() => {
                setShowMenuDrawer(false);
                setShowCallsModal(true);
              }}
            >
              <div className="menu-drawer-item-left">
                <PhoneCall size={18} className="menu-drawer-item-icon" />
                <span>Звонки</span>
              </div>
            </div>

            <div
              className="menu-drawer-item"
              onClick={() => {
                setShowMenuDrawer(false);
                setActiveChat(user.id);
              }}
            >
              <div className="menu-drawer-item-left">
                <Bookmark size={18} className="menu-drawer-item-icon" />
                <span>Избранное</span>
              </div>
            </div>

            <div
              style={{
                height: "1px",
                background: "var(--border-color)",
                margin: "14px 0 10px",
              }}
            ></div>
            <div
              style={{
                padding: "0 1.25rem 8px",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Дополнительно
            </div>

            {user?.role === "admin" && (
              <div
                className="menu-drawer-item"
                onClick={() => {
                  setShowMenuDrawer(false);
                  setShowAdminPanel(true);
                }}
              >
                <div className="menu-drawer-item-left">
                  <Shield
                    size={18}
                    className="menu-drawer-item-icon"
                    style={{ color: "var(--accent-color)" }}
                  />
                  <span>Панель владельца</span>
                </div>
              </div>
            )}

            <div className="menu-drawer-item" style={{ cursor: "default" }}>
              <div className="menu-drawer-item-left">
                {nightMode ? (
                  <Moon size={18} className="menu-drawer-item-icon" />
                ) : (
                  <Sun size={18} className="menu-drawer-item-icon" />
                )}
                <span>Ночной режим</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={nightMode}
                  onChange={(e) => toggleNightMode(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="menu-drawer-version">
              Nexa Android Версия 1.0 Beta Test
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================================
         WALLET MODAL (Competitor feature)
         ========================================================================== */}
      {showWalletModal && (
        <div className="modal active" onClick={() => setShowWalletModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px" }}
          >
            <header>
              <h3>Кошелёк Nexa</h3>
              <button
                className="close-modal"
                onClick={() => setShowWalletModal(false)}
              >
                <X size={20} />
              </button>
            </header>
            <div
              className="settings-body"
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div
                style={{
                  background: "var(--accent-gradient)",
                  padding: "24px",
                  borderRadius: "16px",
                  color: "black",
                  textAlign: "center",
                  boxShadow: "0 8px 24px rgba(103, 232, 249, 0.2)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    opacity: 0.8,
                  }}
                >
                  Текущий баланс
                </p>
                <h1
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 800,
                    margin: "8px 0 0",
                    letterSpacing: "-1px",
                  }}
                >
                  {walletBalance}{" "}
                  <span style={{ fontSize: "1.5rem" }}>GRID</span>
                </h1>
              </div>

              {walletError && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    background: "rgba(239, 68, 68, 0.1)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                  }}
                >
                  {walletError}
                </div>
              )}
              {walletSuccess && (
                <div
                  style={{
                    color: "#10b981",
                    fontSize: "0.85rem",
                    background: "rgba(16, 185, 129, 0.1)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                  }}
                >
                  {walletSuccess}
                </div>
              )}

              <form
                onSubmit={handleWalletTransfer}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    fontSize: "0.75rem",
                    letterSpacing: "0.5px",
                  }}
                >
                  Перевести средства защищенной сети
                </h4>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Никнейм (без @)"
                    value={walletTransferUser}
                    onChange={(e) => setWalletTransferUser(e.target.value)}
                    style={{
                      flex: 1,
                      background: "var(--message-in)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "10px",
                      color: "white",
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Сумма"
                    value={walletTransferAmount}
                    onChange={(e) => setWalletTransferAmount(e.target.value)}
                    style={{
                      width: "100px",
                      background: "var(--message-in)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "10px",
                      color: "white",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="action-btn"
                  style={{
                    background: "var(--accent-color)",
                    color: "#030303",
                    fontWeight: 700,
                    padding: "10px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: "none",
                  }}
                >
                  Отправить
                </button>
              </form>

              <div>
                <h4
                  style={{
                    margin: "12px 0 8px",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    fontSize: "0.75rem",
                    letterSpacing: "0.5px",
                  }}
                >
                  ИСТОРИЯ ОПЕРАЦИЙ
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    maxHeight: "160px",
                    overflowY: "auto",
                  }}
                >
                  {walletTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "rgba(255,255,255,0.02)",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          {tx.desc}
                        </p>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {tx.date}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          color: tx.type === "in" ? "#10b981" : "#ef4444",
                        }}
                      >
                        {tx.type === "in" ? "+" : "-"}
                        {tx.amount} N
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
         CONTACTS LIST OVERLAY 
         ========================================================================== */}
      {showContactsModal && showContactsEntry && (
        <div
          className="modal active"
          onClick={() => setShowContactsModal(false)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "400px" }}
          >
            <header>
              <h3>Список контактов</h3>
              <button
                className="close-modal"
                onClick={() => setShowContactsModal(false)}
              >
                <X size={20} />
              </button>
            </header>
            <div
              className="settings-body"
              style={{
                maxHeight: "350px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <button
                  type="button"
                  onClick={importPhoneContacts}
                  disabled={contactsLoading}
                  style={{
                    flex: 1,
                    background: "var(--accent-color)",
                    color: "#020617",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {contactsLoading ? "Проверяем..." : "Импорт из телефона"}
                </button>
                {phoneContacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => syncPhoneContactsWithNexa(phoneContacts)}
                    disabled={contactsLoading}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Обновить
                  </button>
                )}
              </div>

              <textarea
                value={manualContactsText}
                onChange={(e) => setManualContactsText(e.target.value)}
                placeholder={"Если доступа к телефонной книге нет, вставьте номера по одному в строку"}
                rows={3}
                style={{
                  width: "100%",
                  resize: "none",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  padding: "10px",
                  fontSize: "0.82rem",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={importManualContacts}
                disabled={contactsLoading || !manualContactsText.trim()}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "9px",
                  cursor: manualContactsText.trim() ? "pointer" : "default",
                  opacity: manualContactsText.trim() ? 1 : 0.55,
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                Проверить введенные номера
              </button>

              {contactsError && (
                <div style={{ color: "#fca5a5", fontSize: "0.78rem", marginBottom: "4px" }}>
                  {contactsError}
                </div>
              )}

              {phoneContacts.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
                    Контакты телефона: {phoneContacts.filter((contact) => contact.user).length} в NEXA / {phoneContacts.length} всего
                  </p>
                  {phoneContacts.map((contact) => {
                    const matchedUser = contact.user;
                    return (
                      <div
                        key={contact.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)",
                          background: matchedUser ? "rgba(16, 185, 129, 0.06)" : "rgba(255,255,255,0.025)",
                        }}
                      >
                        <div
                          className="avatar"
                          style={{
                            backgroundColor: matchedUser?.avatarColor || "#64748b",
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                          }}
                        >
                          {matchedUser?.initials || "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem" }}>
                            {matchedUser?.nickname || contact.name}
                          </p>
                          <span style={{ color: matchedUser ? "var(--accent-color)" : "var(--text-secondary)", fontSize: "0.75rem" }}>
                            {matchedUser ? `В NEXA: ${matchedUser.nexaId || contact.matchedPhone || ""}` : contact.phones[0]}
                          </span>
                        </div>
                        {matchedUser ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChat(matchedUser.id);
                              setShowContactsModal(false);
                            }}
                            style={{
                              background: "rgba(0, 239, 255, 0.14)",
                              border: "1px solid rgba(0, 239, 255, 0.28)",
                              color: "var(--accent-color)",
                              borderRadius: "8px",
                              padding: "8px",
                              cursor: "pointer",
                              display: "flex",
                            }}
                            title="Открыть чат"
                          >
                            <PhoneCall size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => invitePhoneContact(contact)}
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid var(--border-color)",
                              color: "var(--text-primary)",
                              borderRadius: "8px",
                              padding: "8px",
                              cursor: "pointer",
                              display: "flex",
                            }}
                            title="Пригласить в NEXA"
                          >
                            <UserPlus size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(() => {
                const myContacts = onlineUsers.filter((u) => {
                  const hasMessages =
                    chats[u.id]?.messages && chats[u.id].messages.length > 0;
                  return u.id === user.id || hasMessages || activeChat === u.id;
                });
                return (
                  <>
                    <p
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                        marginBottom: "8px",
                      }}
                    >
                      Показаны ваши контакты: ({myContacts.length})
                    </p>
                    {myContacts.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "24px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Нет сохраненных контактов
                      </div>
                    ) : (
                      myContacts.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setActiveChat(u.id);
                            setShowContactsModal(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "10px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            border: "1px solid var(--border-color)",
                            transition: "background 0.2s",
                          }}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.background =
                              "rgba(255,255,255,0.05)")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <div
                            className="avatar"
                            style={{
                              backgroundColor: u.avatarColor,
                              width: 36,
                              height: 36,
                            }}
                          >
                            {u.initials}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p
                              style={{
                                margin: 0,
                                fontWeight: 600,
                                fontSize: "0.9rem",
                              }}
                            >
                              {u.nickname}
                            </p>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--accent-color)",
                              }}
                            >
                              {u.nexaId || "В сети"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
         CALLS LOG DETAILS OVERLAY
         ========================================================================== */}
      {showCallsModal && (
        <div className="modal active" onClick={() => setShowCallsModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "400px" }}
          >
            <header>
              <h3>Журнал звонков</h3>
              <button
                className="close-modal"
                onClick={() => setShowCallsModal(false)}
              >
                <X size={20} />
              </button>
            </header>
            <div
              className="settings-body"
              style={{
                maxHeight: "350px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {callLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(255,255,255,0.02)",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background:
                          log.status === "incoming"
                            ? "#10b981"
                            : log.status === "missed"
                              ? "#ef4444"
                              : "var(--accent-color)",
                      }}
                    ></div>
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          fontSize: "0.9rem",
                        }}
                      >
                        @{log.name}
                      </p>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {log.status === "incoming"
                          ? "Входящий"
                          : log.status === "missed"
                            ? "Пропущенный"
                            : "Исходящий"}{" "}
                        ({log.type === "video" ? "Видео" : "Аудио"})
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {log.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
         CHANNEL CREATOR MODAL
         ========================================================================== */}
      {showChannelModal && (
        <Suspense fallback={null}>
          <CreateChannelModal
            onClose={() => setShowChannelModal(false)}
            handleCreateChannel={onCreateChannel}
          />
        </Suspense>
      )}

      {/* ==========================================================================
         CALL OVERLAY DISPLAY PANEL (VoIP WebRTC Signaller)
         ========================================================================== */}
      {callState.status !== "idle" && (
        <div className="call-overlay">
          <div className="call-header">
            <div className="call-avatar-container">
              <div className="call-pulse-circle"></div>
              <div className="call-pulse-circle-2"></div>
              <div
                className="avatar"
                style={{
                  backgroundColor: callState.partner?.avatarColor,
                  backgroundImage: callState.partner?.avatarImage
                    ? `url(${callState.partner?.avatarImage})`
                    : "none",
                  width: 90,
                  height: 90,
                  fontSize: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  border: "3px solid var(--accent-color)",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                }}
              >
                {!callState.partner?.avatarImage &&
                  (callState.partner?.initials ||
                    getInitials(callState.partner?.nickname || "?"))}
              </div>
            </div>
            <h2
              style={{ fontSize: "1.6rem", fontWeight: 700, margin: "8px 0 0" }}
            >
              @{callState.partner?.nickname}
            </h2>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--accent-color)",
                margin: "4px 0 0",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontWeight: 600,
              }}
            >
              {callState.status === "calling" && "Звоним..."}
              {callState.status === "incoming" && "Входящий вызов..."}
              {callState.status === "connecting" && "Подключение сервера..."}
              {callState.status === "connected" &&
                `В СЕТИ • ${formatDuration(callState.duration)}`}
              {callState.status === "ended" && "Разговор окончен"}
            </p>
          </div>

          <div className="call-body">
            {callState.type === "video" && callState.status === "connected" && (
              <div className="call-video-grid">
                <div className="call-video-tile">
                  {callState.isVideoOff ? (
                    <div
                      style={{
                        color: "var(--text-secondary)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <VideoOff size={36} />
                      <span style={{ fontSize: "0.85rem" }}>
                        Камера собеседника выключена
                      </span>
                    </div>
                  ) : (
                    <video
                      id="remote-video"
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "12px",
                      }}
                    />
                  )}
                </div>
                {/* Local user small tile overlay */}
                <div className="call-video-tile local">
                  {callState.isMuted ? (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background: "rgba(255,255,255,0.02)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Камера выключена
                      </span>
                    </div>
                  ) : (
                    <video
                      id="local-video"
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )}
                </div>
              </div>
            )}
            {callState.type === "audio" && callState.status === "connected" && (
              <div
                style={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  padding: "16px",
                }}
              >
                <Mic size={48} style={{ color: "var(--accent-color)" }} />
                <span
                  style={{ fontSize: "14px", color: "var(--text-secondary)" }}
                >
                  Голосовая связь активна
                </span>
              </div>
            )}
          </div>

          <div className="call-actions-row">
            {callState.status === "incoming" ? (
              <>
                <button
                  onClick={handleRejectCall}
                  className="call-btn decline"
                  title="Отклонить вызов"
                >
                  <PhoneOff size={24} />
                </button>
                <button
                  onClick={handleAcceptCall}
                  className="call-btn accept"
                  title="Принять вызов"
                >
                  <Phone size={24} />
                </button>
              </>
            ) : (
              <>
                {callState.status === "connected" && (
                  <>
                    <button
                      onClick={() => {
                        // Mute/unmute audio stream
                        if (localStreamRef.current) {
                          localStreamRef.current.getAudioTracks().forEach(track => {
                            track.enabled = callState.isMuted;
                          });
                        }
                        setCallState((prev) => ({
                          ...prev,
                          isMuted: !prev.isMuted,
                        }));
                      }}
                      className={`call-btn utility ${callState.isMuted ? "active" : ""}`}
                      title={
                        callState.isMuted
                          ? "Включить микрофон"
                          : "Выключить микрофон"
                      }
                    >
                      {callState.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    {callState.type === "video" && (
                      <button
                        onClick={() =>
                          setCallState((prev) => ({
                            ...prev,
                            isVideoOff: !prev.isVideoOff,
                          }))
                        }
                        className={`call-btn utility ${callState.isVideoOff ? "active" : ""}`}
                        title={
                          callState.isVideoOff
                            ? "Включить камеру"
                            : "Выключить камеру"
                        }
                      >
                        <Video size={20} />
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={handleEndCall}
                  className="call-btn decline"
                  title="Завершить вызов"
                >
                  <PhoneOff size={24} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
         FORWARD MESSAGE MODAL
         ========================================================================== */}
      {forwardingMessage && (
        <div
          className="modal active"
          onClick={() => setForwardingMessage(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px" }}
          >
            <header>
              <h3>Переслать сообщение</h3>
              <button
                className="close-modal"
                onClick={() => setForwardingMessage(null)}
              >
                <X size={20} />
              </button>
            </header>
            <div
              className="settings-body"
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--accent-color)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Пересылаемое сообщение от @
                  {forwardingMessage.from?.nickname || "Неизвестно"}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    fontStyle:
                      forwardingMessage.type !== "text" ? "italic" : "normal",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {forwardingMessage.type === "text"
                    ? forwardingMessage.text?.startsWith("[E2EE]")
                      ? "🔒 Зашифрованное текстовое сообщение"
                      : forwardingMessage.text
                    : `[${forwardingMessage.type.toUpperCase()}]`}
                </span>
              </div>

              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Поиск собеседника или группы..."
                  value={forwardSearchTerm}
                  onChange={(e) => setForwardSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--message-in)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "10px 12px 10px 36px",
                    color: "white",
                    fontSize: "14px",
                  }}
                />
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-secondary)",
                  }}
                />
              </div>

              <div
                style={{
                  maxHeight: "280px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {(() => {
                  const filteredUsers = [...onlineUsers, ...allUsers]
                    .filter(
                      (u, i, self) =>
                        self.findIndex((x) => x.id === u.id) === i,
                    ) // Deduplicate
                    .filter((u) =>
                      u.nickname
                        ?.toLowerCase()
                        .includes(forwardSearchTerm.toLowerCase()),
                    );

                  const filteredGroups = groups.filter((g) =>
                    g.name
                      ?.toLowerCase()
                      .includes(forwardSearchTerm.toLowerCase()),
                  );

                  const items = [
                    ...filteredUsers.map((u) => ({
                      id: u.id,
                      name: `@${u.nickname}`,
                      sub: u.firstName
                        ? `${u.firstName} ${u.lastName || ""}`
                        : "Пользователь Nexa",
                      isGroup: false,
                      avatarColor: u.avatarColor,
                      avatarImage: u.avatarImage,
                      initials: u.initials,
                    })),
                    ...filteredGroups.map((g) => ({
                      id: g.id,
                      name: g.name,
                      sub: `${g.members?.length || 0} ${g.name.includes("📢") ? "подписчиков" : "участников"}`,
                      isGroup: true,
                      avatarColor: g.avatarColor,
                      avatarImage: g.avatarImage,
                      initials: g.initials,
                    })),
                  ];

                  if (items.length === 0) {
                    return (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "24px",
                          color: "var(--text-secondary)",
                          fontSize: "14px",
                        }}
                      >
                        Ничего не найдено
                      </div>
                    );
                  }

                  return items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleForwardTo(item.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        border: "1px solid var(--border-color)",
                        transition: "all 0.2s",
                        background: "rgba(255,255,255,0.01)",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.05)";
                        e.currentTarget.style.borderColor =
                          "var(--accent-color)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.01)";
                        e.currentTarget.style.borderColor =
                          "var(--border-color)";
                      }}
                    >
                      <div
                        className="avatar"
                        style={{
                          backgroundColor: item.avatarColor,
                          backgroundImage: item.avatarImage
                            ? `url(${item.avatarImage})`
                            : "none",
                          width: 36,
                          height: 36,
                          fontSize: "14px",
                        }}
                      >
                        {!item.avatarImage &&
                          (item.initials || getInitials(item.name))}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: 600,
                            fontSize: "14px",
                            color: "white",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.name}
                        </p>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {item.sub}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleForwardTo(item.id);
                        }}
                        style={{
                          background: "rgba(0, 239, 255, 0.1)",
                          color: "var(--accent-color)",
                          border: "1px solid rgba(0, 239, 255, 0.2)",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background =
                            "var(--accent-color)";
                          e.currentTarget.style.color = "black";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background =
                            "rgba(0, 239, 255, 0.1)";
                          e.currentTarget.style.color = "var(--accent-color)";
                        }}
                      >
                        Отправить
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default App;
