import React from 'react';
import { Paperclip, CornerUpLeft, Pencil, Trash2, Forward, Play, Pause } from 'lucide-react';
import { Message, User } from '../../../types/chat';
import { resolveApiUrl } from '../../../utils/api';

interface MessageBubbleProps {
  msg: Message;
  isOutgoing: boolean;
  isGroupChat: boolean;
  displayText: React.ReactNode;
  senderUser?: User;
  currentUser?: User | null;
  onReply?: (msg: Message) => void;
  onReact?: (msgId: string, emoji: string) => void;
  senderNameOverride?: string;
  groupCreatorId?: string;
  onEdit?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  isGroupOwner?: boolean;
  isGroupCoOwner?: boolean;
  onForward?: (msg: Message) => void;
}

const formatMediaTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  isOutgoing,
  isGroupChat,
  displayText,
  senderUser,
  currentUser,
  onReply,
  onReact,
  senderNameOverride,
  groupCreatorId,
  onEdit,
  onDelete,
  isGroupOwner,
  isGroupCoOwner,
  onForward,
}) => {
  const videoNoteRef = React.useRef<HTMLVideoElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isVideoNotePlaying, setIsVideoNotePlaying] = React.useState(false);
  const [videoNoteDuration, setVideoNoteDuration] = React.useState(0);
  const [videoNoteCurrentTime, setVideoNoteCurrentTime] = React.useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const [audioDuration, setAudioDuration] = React.useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = React.useState(0);

  const resolveMediaSrc = (src?: string | null) => {
    if (!src || src === 'shared') return '';
    return src.startsWith('/') ? resolveApiUrl(src) : src;
  };

  const mediaSrc = resolveMediaSrc(msg.data);
  const isVideoNote = msg.type === 'video' && (msg.text === '[VIDEO_NOTE]' || msg.mediaKind === 'video-note');
  const isAudioMessage = msg.type === 'audio';
  const videoNoteProgress = videoNoteDuration > 0 ? Math.min(videoNoteCurrentTime / videoNoteDuration, 1) : 0;
  const videoNoteTimeLabel = formatMediaTime(isVideoNotePlaying ? videoNoteCurrentTime : videoNoteDuration);
  const audioProgress = audioDuration > 0 ? Math.min(audioCurrentTime / audioDuration, 1) : 0;
  const audioTimeLabel = formatMediaTime(isAudioPlaying ? audioCurrentTime : audioDuration);
  const waveformBars = React.useMemo(() => {
    const seed = Array.from(msg.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return Array.from({ length: 44 }, (_, index) => 8 + ((seed + index * 13) % 22));
  }, [msg.id]);

  const toggleVideoNote = async () => {
    const video = videoNoteRef.current;
    if (!video) return;

    if (video.paused) {
      if (video.ended) video.currentTime = 0;
      await video.play().catch(() => {});
      setIsVideoNotePlaying(!video.paused);
    } else {
      video.pause();
      setIsVideoNotePlaying(false);
    }
  };

  const syncVideoNoteTime = () => {
    const video = videoNoteRef.current;
    if (!video) return;
    setVideoNoteCurrentTime(video.currentTime);
    if (Number.isFinite(video.duration)) setVideoNoteDuration(video.duration);
  };

  const handleVideoNoteEnded = () => {
    const video = videoNoteRef.current;
    if (video) video.currentTime = 0;
    setIsVideoNotePlaying(false);
    setVideoNoteCurrentTime(0);
  };

  const syncAudioTime = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioCurrentTime(audio.currentTime);
    if (Number.isFinite(audio.duration)) setAudioDuration(audio.duration);
  };

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      if (audio.ended) audio.currentTime = 0;
      await audio.play().catch(() => {});
      setIsAudioPlaying(!audio.paused);
    } else {
      audio.pause();
      setIsAudioPlaying(false);
    }
  };

  const seekAudio = (event: React.MouseEvent<HTMLButtonElement>) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = ratio * audio.duration;
    setAudioCurrentTime(audio.currentTime);
  };

  const handleAudioEnded = () => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
    setIsAudioPlaying(false);
    setAudioCurrentTime(0);
  };

  const groupedReactions = React.useMemo(() => {
    if (!msg.reactions) return {};
    const groups: Record<string, { count: number; userReacted: boolean }> = {};
    msg.reactions.forEach(r => {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { count: 0, userReacted: false };
      }
      groups[r.emoji].count += 1;
      if (r.userId === currentUser?.id) {
        groups[r.emoji].userReacted = true;
      }
    });
    return groups;
  }, [msg.reactions, currentUser?.id]);

  return (
    <div className={`message ${isOutgoing ? 'outgoing' : 'incoming'} ${msg.type === 'sticker' ? 'sticker-msg' : ''} ${isVideoNote ? 'video-note-message' : ''} ${isAudioMessage ? 'audio-message' : ''}`}>
      {/* Quick Actions Bar (Visible on Hover) */}
      <div className="message-actions-trigger">
        <div className="actions-reactions">
          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
            <button
              key={emoji}
              className="btn-quick-react"
              type="button"
              onClick={() => onReact?.(msg.id, emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="actions-divider" />
        <button
          className="btn-quick-reply"
          type="button"
          title="Reply"
          onClick={() => onReply?.(msg)}
        >
          <CornerUpLeft size={13} />
        </button>

        <button
          className="btn-quick-reply"
          type="button"
          title="Forward"
          onClick={() => onForward?.(msg)}
        >
          <Forward size={13} />
        </button>

        {msg.fromId === currentUser?.id && msg.type === 'text' && (
          <button
            className="btn-quick-reply"
            type="button"
            title="Edit"
            onClick={() => onEdit?.(msg)}
          >
            <Pencil size={13} />
          </button>
        )}

        {(msg.fromId === currentUser?.id || isGroupOwner || isGroupCoOwner) && (
          <button
            className="btn-quick-reply"
            type="button"
            title="Delete"
            onClick={() => onDelete?.(msg)}
            style={{ color: '#ef4444' }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Group Chat Sender Info */}
      {(!isOutgoing || isGroupChat) && (
        <span className="msg-sender" style={{ color: senderUser?.avatarColor || msg.from?.avatarColor }}>
          {senderNameOverride || senderUser?.nickname || msg.from?.nickname || 'Unknown'}
        </span>
      )}

      {/* Message Reply Quote Block */}
      {msg.replyTo && (
        <div className="reply-quote">
          <div className="reply-quote-sender" style={{ color: msg.replyTo.from?.avatarColor }}>
            {groupCreatorId && msg.replyTo.fromId === groupCreatorId ? "Владелец" : (msg.replyTo.from?.nickname || 'Unknown')}
          </div>
          <div className="reply-quote-text">
            {msg.replyTo.type === 'text'
              ? msg.replyTo.text
              : `[${msg.replyTo.type.charAt(0).toUpperCase() + msg.replyTo.type.slice(1)}]`}
          </div>
        </div>
      )}

      {/* Message Content */}
      {msg.type === 'text' ? (
        <div>{displayText}</div>
      ) : msg.type === 'image' ? (
        mediaSrc ? <img src={mediaSrc} className="media-content" alt="" /> : <div className="media-unsupported">Media file is unavailable</div>
      ) : msg.type === 'sticker' ? (
        mediaSrc ? <img src={mediaSrc} className="sticker-content" alt="sticker" /> : <div className="media-unsupported">Media file is unavailable</div>
      ) : msg.type === 'audio' ? (
        <div className="audio-player">
          {mediaSrc ? (
            <div className="voice-message">
              <audio
                ref={audioRef}
                preload="metadata"
                src={mediaSrc}
                onLoadedMetadata={syncAudioTime}
                onTimeUpdate={syncAudioTime}
                onPlay={() => setIsAudioPlaying(true)}
                onPause={() => setIsAudioPlaying(false)}
                onEnded={handleAudioEnded}
              />
              <button
                type="button"
                className="voice-play-button"
                onClick={toggleAudio}
                aria-label={isAudioPlaying ? 'Pause voice message' : 'Play voice message'}
              >
                {isAudioPlaying ? <Pause size={20} /> : <Play size={22} fill="currentColor" />}
              </button>
              <div className="voice-body">
                <button
                  type="button"
                  className="voice-waveform"
                  onClick={seekAudio}
                  aria-label="Seek voice message"
                >
                  {waveformBars.map((height, index) => (
                    <span
                      key={`${msg.id}-bar-${index}`}
                      className={(index + 1) / waveformBars.length <= audioProgress ? 'played' : ''}
                      style={{ height: `${height}px` }}
                    />
                  ))}
                </button>
                <div className="voice-meta">
                  <span>{audioTimeLabel}</span>
                  <span>Голосовое</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="media-unsupported">Audio file is unavailable</div>
          )}
        </div>
      ) : msg.type === 'video' ? (
        !mediaSrc ? (
          <div className="media-unsupported">Video file is unavailable</div>
        ) : isVideoNote ? (
          <button
            type="button"
            className="video-note"
            onClick={toggleVideoNote}
            aria-label={isVideoNotePlaying ? 'Pause video message' : 'Play video message'}
            style={{ '--video-note-progress': `${videoNoteProgress * 360}deg` } as React.CSSProperties}
          >
            <video
              ref={videoNoteRef}
              src={mediaSrc}
              className="video-note-media"
              playsInline
              preload="metadata"
              onPlay={() => setIsVideoNotePlaying(true)}
              onPause={() => setIsVideoNotePlaying(false)}
              onLoadedMetadata={syncVideoNoteTime}
              onTimeUpdate={syncVideoNoteTime}
              onEnded={handleVideoNoteEnded}
            />
            <span className="video-note-progress" />
            <span className={`video-note-control ${isVideoNotePlaying ? 'playing' : ''}`}>
              {isVideoNotePlaying ? <Pause size={22} /> : <Play size={24} fill="currentColor" />}
            </span>
            <span className="video-note-time">{videoNoteTimeLabel}</span>
          </button>
        ) : (
          <video controls preload="metadata" src={mediaSrc} className="media-content" />
        )
      ) : msg.data ? (
        <div className="file-attachment">
          <Paperclip size={16} />
          <a href={mediaSrc} download={typeof displayText === 'string' ? displayText.replace('File: ', '') : (typeof msg.text === 'string' ? msg.text.replace('File: ', '') : 'file')}>{displayText}</a>
        </div>
      ) : (
        <div className="media-unsupported">Media type not supported in this view</div>
      )}

      {/* Message Reaction Badges */}
      {msg.reactions && msg.reactions.length > 0 && (
        <div className="reactions-container">
          {Object.entries(groupedReactions).map(([emoji, details]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact?.(msg.id, emoji)}
              className={`reaction-badge ${details.userReacted ? 'reacted' : ''}`}
            >
              <span>{emoji}</span>
              <span className="reaction-count">{details.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Message Timing and Receipt Status */}
      <div className="msg-info" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {msg.isEdited && <span style={{ marginRight: '2px', fontStyle: 'italic', opacity: 0.5, fontSize: '0.7rem' }}>изм.</span>}
        
        {(msg as any).isChannelPost && (
          <span className="msg-views" style={{ marginRight: '6px', opacity: 0.6, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span>👁</span>
            <span>{(msg as any).views || 0}</span>
          </span>
        )}

        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        
        {!(msg as any).isChannelPost && isOutgoing && msg.status && (
          <span className="msg-status" style={{ marginLeft: '4px' }}>
            {msg.status === 'sending' && '⏳'}
            {msg.status === 'sent' && '✓'}
            {msg.status === 'delivered' && '✓✓'}
            {msg.status === 'read' && <span style={{ color: '#00efff' }}>✓✓</span>}
          </span>
        )}
      </div>
    </div>
  );
};
