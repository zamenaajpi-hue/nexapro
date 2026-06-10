var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/services/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db,
  getPrisma: () => getPrisma
});
function getPrisma() {
  if (!prisma) {
    try {
      prisma = new import_client.PrismaClient({
        log: ["error", "warn"]
      });
    } catch (error) {
      console.error("\n============================= PRISMA ERROR =============================");
      console.error("\u274C \u041D\u0415 \u0423\u0414\u0410\u041B\u041E\u0421\u042C \u0418\u041D\u0418\u0426\u0418\u0410\u041B\u0418\u0417\u0418\u0420\u041E\u0412\u0410\u0422\u042C DATABASE CLIENT!");
      console.error("\u{1F449} \u0420\u0435\u0448\u0435\u043D\u0438\u0435: \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044E Prisma Client \u0432 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0435 \u0432\u0430\u0448\u0435\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430:");
      console.error("   npx prisma generate");
      console.error("========================================================================\n");
      throw error;
    }
  }
  return prisma;
}
var import_client, prisma, db;
var init_db = __esm({
  "src/services/db.ts"() {
    import_client = require("@prisma/client");
    prisma = null;
    db = new Proxy({}, {
      get(target, prop, receiver) {
        try {
          const client2 = getPrisma();
          const value = Reflect.get(client2, prop, receiver);
          if (typeof value === "function") {
            return value.bind(client2);
          }
          return value;
        } catch (err) {
          console.error("\n\u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0438 \u043A \u0431\u0430\u0437\u0435 \u0434\u0430\u043D\u043D\u044B\u0445. \u0423\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044C, \u0447\u0442\u043E \u0432\u044B \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B\u0438 'npx prisma generate'.\n");
          throw err;
        }
      }
    });
  }
});

// src/server/repositories/user.repository.ts
var user_repository_exports = {};
__export(user_repository_exports, {
  userRepository: () => userRepository
});
var userRepository;
var init_user_repository = __esm({
  "src/server/repositories/user.repository.ts"() {
    init_db();
    userRepository = {
      findByEmailOrNickname: async (email, nickname) => db.user.findFirst({ where: { OR: [{ email }, { nickname }] } }),
      findByEmail: async (email) => db.user.findUnique({ where: { email } }),
      findById: async (id) => db.user.findUnique({ where: { id } }),
      count: async () => db.user.count(),
      create: async (data) => db.user.create({ data }),
      update: async (id, data) => db.user.update({ where: { id }, data }),
      findMany: async (args = {}) => db.user.findMany(args),
      deleteWithRelations: async (id) => {
        const [ownedGroups, ownedChannels, authoredPosts, userMessages] = await Promise.all([
          db.group.findMany({ where: { creatorId: id }, select: { id: true } }),
          db.channel.findMany({ where: { ownerId: id }, select: { id: true } }),
          db.channelPost.findMany({ where: { authorId: id }, select: { id: true } }),
          db.message.findMany({
            where: { OR: [{ fromId: id }, { toUserId: id }] },
            select: { id: true }
          })
        ]);
        const ownedGroupIds = ownedGroups.map((g) => g.id);
        const ownedChannelIds = ownedChannels.map((c) => c.id);
        const authoredPostIds = authoredPosts.map((p) => p.id);
        const userMessageIds = userMessages.map((m) => m.id);
        const ownedGroupMessages = ownedGroupIds.length ? await db.message.findMany({
          where: { toGroupId: { in: ownedGroupIds } },
          select: { id: true }
        }) : [];
        const deletedMessageIds = Array.from(/* @__PURE__ */ new Set([
          ...userMessageIds,
          ...ownedGroupMessages.map((m) => m.id)
        ]));
        return db.$transaction([
          db.reaction.deleteMany({
            where: {
              OR: [
                { userId: id },
                deletedMessageIds.length ? { messageId: { in: deletedMessageIds } } : { id: "__never__" }
              ]
            }
          }),
          db.channelReaction.deleteMany({
            where: {
              OR: [
                { userId: id },
                authoredPostIds.length ? { postId: { in: authoredPostIds } } : { id: "__never__" }
              ]
            }
          }),
          db.storyView.deleteMany({ where: { userId: id } }),
          db.storyReaction.deleteMany({ where: { userId: id } }),
          db.chatState.deleteMany({ where: { userId: id } }),
          db.messageReceipt.deleteMany({ where: { userId: id } }),
          db.savedMessage.deleteMany({ where: { userId: id } }),
          db.closeFriend.deleteMany({ where: { OR: [{ ownerId: id }, { friendId: id }] } }),
          db.uploadedFile.deleteMany({ where: { userId: id } }),
          db.pushToken.deleteMany({ where: { userId: id } }),
          deletedMessageIds.length ? db.message.updateMany({ where: { replyToId: { in: deletedMessageIds } }, data: { replyToId: null } }) : db.message.updateMany({ where: { id: "__never__" }, data: { replyToId: null } }),
          db.message.deleteMany({
            where: {
              OR: [
                { fromId: id },
                { toUserId: id },
                ownedGroupIds.length ? { toGroupId: { in: ownedGroupIds } } : { id: "__never__" }
              ]
            }
          }),
          db.channelPost.deleteMany({ where: { authorId: id } }),
          db.channelMember.deleteMany({ where: { userId: id } }),
          db.groupMember.deleteMany({ where: { userId: id } }),
          ownedChannelIds.length ? db.channel.deleteMany({ where: { id: { in: ownedChannelIds } } }) : db.channel.deleteMany({ where: { id: "__never__" } }),
          ownedGroupIds.length ? db.group.deleteMany({ where: { id: { in: ownedGroupIds } } }) : db.group.deleteMany({ where: { id: "__never__" } }),
          db.story.deleteMany({ where: { userId: id } }),
          db.user.delete({ where: { id } })
        ]);
      }
    };
  }
});

// src/server/repositories/chat-state.repository.ts
var chat_state_repository_exports = {};
__export(chat_state_repository_exports, {
  chatStateRepository: () => chatStateRepository
});
var chatStateRepository;
var init_chat_state_repository = __esm({
  "src/server/repositories/chat-state.repository.ts"() {
    init_db();
    chatStateRepository = {
      findForUser: async (userId) => db.chatState.findMany({
        where: { userId },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }]
      }),
      upsert: async ({
        userId,
        chatId,
        chatType,
        unreadDelta,
        unread,
        pinned,
        archived,
        mutedUntil,
        lastReadAt
      }) => {
        const createData = {
          userId,
          chatId,
          chatType,
          unread: unread ?? Math.max(0, unreadDelta ?? 0),
          pinned: pinned ?? false,
          archived: archived ?? false,
          mutedUntil,
          lastReadAt
        };
        const updateData = {};
        if (typeof unread === "number") updateData.unread = Math.max(0, unread);
        if (typeof unreadDelta === "number") updateData.unread = { increment: unreadDelta };
        if (typeof pinned === "boolean") updateData.pinned = pinned;
        if (typeof archived === "boolean") updateData.archived = archived;
        if (mutedUntil !== void 0) updateData.mutedUntil = mutedUntil;
        if (lastReadAt !== void 0) updateData.lastReadAt = lastReadAt;
        return db.chatState.upsert({
          where: { userId_chatId_chatType: { userId, chatId, chatType } },
          create: createData,
          update: updateData
        });
      },
      touch: async (userId, chatId, chatType) => chatStateRepository.upsert({ userId, chatId, chatType, unreadDelta: 0 }),
      incrementUnread: async (userId, chatId, chatType) => chatStateRepository.upsert({ userId, chatId, chatType, unreadDelta: 1, archived: false }),
      markRead: async (userId, chatId, chatType) => chatStateRepository.upsert({
        userId,
        chatId,
        chatType,
        unread: 0,
        lastReadAt: /* @__PURE__ */ new Date()
      }),
      updatePreferences: async (userId, chatId, chatType, data) => chatStateRepository.upsert({ userId, chatId, chatType, ...data })
    };
  }
});

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_http = require("http");
var import_socket = require("socket.io");
var import_path = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_multer = __toESM(require("multer"), 1);
var import_pino = __toESM(require("pino"), 1);
var import_pino_http = __toESM(require("pino-http"), 1);
var import_prom_client = __toESM(require("prom-client"), 1);
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);
var import_ioredis = require("ioredis");
var import_redis_adapter = require("@socket.io/redis-adapter");
var import_child_process = require("child_process");

// src/server/services/auth.service.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
init_user_repository();
init_db();

// src/server/config/auth.ts
var DEV_JWT_SECRET = "dev-only-nexa-secret";
var WEAK_SECRET_PATTERN = /change[_-]?me|dev[_-]?only|default|example|secret[_-]?key|super[_-]?secret/i;
var isStrongJwtSecret = (secret) => {
  const value = secret?.trim() || "";
  return value.length >= 32 && !WEAK_SECRET_PATTERN.test(value);
};
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (isStrongJwtSecret(secret)) {
    return secret.trim();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a strong value in production");
  }
  return secret || DEV_JWT_SECRET;
}

// src/server/utils/safeUser.ts
var publicFields = (u) => ({
  id: u.id,
  nickname: u.nickname,
  nexaId: u.nexaId,
  avatarColor: u.avatarColor,
  avatarImage: u.avatarImage,
  initials: u.initials,
  bio: u.bio,
  publicKey: u.publicKey,
  status: u.status
});
var publicUserDto = (u) => {
  if (!u) return u;
  return publicFields(u);
};
var privateUserDto = (u) => {
  if (!u) return u;
  return {
    ...publicFields(u),
    email: u.email,
    phoneNumber: u.phoneNumber,
    firstName: u.firstName,
    lastName: u.lastName,
    dateOfBirth: u.dateOfBirth,
    activityStatus: u.activityStatus,
    role: u.role,
    balance: u.balance,
    ownedAvatars: u.ownedAvatars,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  };
};
var adminUserDto = (u) => privateUserDto(u);
var publicUsersDto = (users) => users.map(publicUserDto);
var safeUser = publicUserDto;

// src/server/services/auth.service.ts
var getInitials = (name) => name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?";
var normalizePhone = (phone) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) return `7${digits.slice(1)}`;
  return digits;
};
var authService = {
  register: async (data) => {
    const existing = await userRepository.findByEmailOrNickname(data.email, data.nickname);
    if (existing) throw new Error("User already exists");
    const passwordHash = await import_bcryptjs.default.hash(data.password, 10);
    const role = "user";
    let nexaId = "";
    let isUnique = false;
    while (!isUnique) {
      const randomNum = Math.floor(1e5 + Math.random() * 9e5);
      nexaId = `nexa-${randomNum}`;
      const existingWithId = await db.user.findFirst({ where: { nexaId } });
      if (!existingWithId) {
        isUnique = true;
      }
    }
    const user = await userRepository.create({
      email: data.email,
      phoneNumber: data.phoneNumber || null,
      normalizedPhone: normalizePhone(data.phoneNumber),
      nickname: data.nickname,
      nexaId,
      passwordHash,
      avatarColor: data.avatarColor || "#6C63FF",
      initials: getInitials(data.nickname),
      publicKey: data.publicKey,
      role
    });
    await db.groupMember.create({
      data: {
        userId: user.id,
        groupId: "test-group-id"
      }
    }).catch(() => {
    });
    const token = import_jsonwebtoken.default.sign({ userId: user.id }, getJwtSecret(), { expiresIn: "7d" });
    return { user: privateUserDto(user), token };
  },
  login: async (data) => {
    const user = await userRepository.findByEmail(data.email);
    if (!user || !user.passwordHash) throw new Error("Invalid credentials");
    const isValid = await import_bcryptjs.default.compare(data.password, user.passwordHash);
    if (!isValid) throw new Error("Invalid credentials");
    const token = import_jsonwebtoken.default.sign({ userId: user.id }, getJwtSecret(), { expiresIn: "7d" });
    return { user: privateUserDto(user), token };
  }
};

// src/server/validations/auth.schema.ts
var import_zod = require("zod");
var registerSchema = import_zod.z.object({
  email: import_zod.z.string().email("Invalid email format"),
  nickname: import_zod.z.string().min(2, "Nickname must be at least 2 characters"),
  password: import_zod.z.string().min(6, "Password must be at least 6 characters"),
  phoneNumber: import_zod.z.string().max(32).optional(),
  avatarColor: import_zod.z.string().optional(),
  publicKey: import_zod.z.string().optional()
});
var loginSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(6)
});

// src/server/controllers/auth.controller.ts
var import_zod2 = require("zod");
var authController = {
  register: async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);
      res.json(result);
    } catch (err) {
      if (err instanceof import_zod2.z.ZodError) {
        res.status(400).json({ error: "Validation Error", details: err.issues });
        return;
      }
      console.error(err);
      res.status(err.message === "User already exists" ? 400 : 500).json({ error: err.message || "Registration failed" });
    }
  },
  login: async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);
      res.json(result);
    } catch (err) {
      if (err instanceof import_zod2.z.ZodError) {
        res.status(400).json({ error: "Validation Error", details: err.issues });
        return;
      }
      res.status(err.message === "Invalid credentials" ? 401 : 500).json({ error: err.message || "Login failed" });
    }
  }
};

// src/server/services/admin.service.ts
init_user_repository();

// src/server/repositories/group.repository.ts
init_db();
var groupRepository = {
  findById: async (id, includeMembers = false) => db.group.findUnique({
    where: { id },
    include: includeMembers ? { members: { include: { user: true } } } : void 0
  }),
  count: async () => db.group.count(),
  findMany: async (args = {}) => db.group.findMany(args),
  findForUser: async (userId) => db.group.findMany({
    where: { members: { some: { userId } } },
    include: { members: { include: { user: true } } }
  }),
  create: async (data, includeMembers = false) => db.group.create({
    data,
    include: includeMembers ? { members: { include: { user: true } } } : void 0
  }),
  update: async (id, data, includeMembers = false) => db.group.update({
    where: { id },
    data,
    include: includeMembers ? { members: { include: { user: true } } } : void 0
  }),
  addMember: async (groupId, userId) => db.groupMember.upsert({
    where: { userId_groupId: { userId, groupId } },
    update: {},
    create: { userId, groupId, role: "member" }
  }),
  deleteWithRelations: async (id) => {
    const messages = await db.message.findMany({
      where: { toGroupId: id },
      select: { id: true }
    });
    const messageIds = messages.map((message) => message.id);
    return db.$transaction([
      messageIds.length ? db.reaction.deleteMany({ where: { messageId: { in: messageIds } } }) : db.reaction.deleteMany({ where: { id: "__never__" } }),
      messageIds.length ? db.message.updateMany({ where: { replyToId: { in: messageIds } }, data: { replyToId: null } }) : db.message.updateMany({ where: { id: "__never__" }, data: { replyToId: null } }),
      db.groupMember.deleteMany({ where: { groupId: id } }),
      db.message.deleteMany({ where: { toGroupId: id } }),
      db.group.delete({ where: { id } })
    ]);
  }
};

// src/server/repositories/message.repository.ts
init_db();
var safeMessage = (message) => {
  if (!message) return message;
  return {
    ...message,
    from: message.from ? safeUser(message.from) : message.from,
    replyTo: message.replyTo ? {
      ...message.replyTo,
      from: message.replyTo.from ? safeUser(message.replyTo.from) : message.replyTo.from
    } : message.replyTo,
    reactions: Array.isArray(message.reactions) ? message.reactions.map((reaction) => ({
      ...reaction,
      user: reaction.user ? safeUser(reaction.user) : reaction.user
    })) : message.reactions
  };
};
var safeMessages = (messages) => messages.map(safeMessage);
var messageRepository = {
  count: async () => db.message.count(),
  findMany: async (args = {}) => db.message.findMany(args),
  delete: async (id) => db.message.delete({ where: { id } }),
  create: async (data, includeRelations = false) => db.message.create({
    data,
    include: includeRelations ? { from: true, replyTo: { include: { from: true } }, reactions: true } : void 0
  }).then(safeMessage),
  getHistoryForGroup: async (groupId, limit = 50) => db.message.findMany({
    where: { toGroupId: groupId },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { from: true, replyTo: { include: { from: true } }, reactions: true }
  }).then(safeMessages),
  getHistoryForDirectMessage: async (userId1, userId2, limit = 50) => db.message.findMany({
    where: {
      OR: [
        { fromId: userId1, toUserId: userId2 },
        { fromId: userId2, toUserId: userId1 }
      ]
    },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { from: true, replyTo: { include: { from: true } }, reactions: true }
  }).then(safeMessages),
  pinMessage: async (id, isPinned) => db.message.update({
    where: { id },
    data: { isPinned },
    include: { from: true, replyTo: { include: { from: true } }, reactions: true }
  }).then(safeMessage),
  toggleReaction: async (messageId, userId, emoji) => {
    const existing = await db.reaction.findUnique({
      where: { userId_messageId_emoji: { userId, messageId, emoji } }
    });
    if (existing) {
      await db.reaction.delete({
        where: { userId_messageId_emoji: { userId, messageId, emoji } }
      });
    } else {
      const userReactions = await db.reaction.findMany({
        where: { userId, messageId }
      });
      if (userReactions.length >= 2) {
        const oldReaction = userReactions[0];
        await db.reaction.delete({
          where: { id: oldReaction.id }
        });
      }
      await db.reaction.create({
        data: { userId, messageId, emoji }
      });
    }
    return db.message.findUnique({
      where: { id: messageId },
      include: { from: true, replyTo: { include: { from: true } }, reactions: true }
    }).then(safeMessage);
  },
  searchMessages: async (currentUserId, chatId, query, isGroup) => {
    return db.message.findMany({
      where: {
        text: { contains: query },
        ...isGroup ? { toGroupId: chatId } : {
          OR: [
            { fromId: currentUserId, toUserId: chatId },
            { fromId: chatId, toUserId: currentUserId }
          ]
        }
      },
      orderBy: { timestamp: "desc" },
      take: 50,
      include: { from: true, replyTo: { include: { from: true } }, reactions: true }
    }).then(safeMessages);
  },
  markAsRead: async (chatId, currentUserId) => {
    return db.message.updateMany({
      where: {
        fromId: chatId,
        toUserId: currentUserId,
        status: { not: "read" }
      },
      data: {
        status: "read"
      }
    });
  },
  markDeliveredToUser: async (userId) => {
    const pendingMessages = await db.message.findMany({
      where: {
        toUserId: userId,
        status: "sent"
      },
      select: { id: true, fromId: true }
    });
    if (pendingMessages.length === 0) {
      return { count: 0, senderIds: [] };
    }
    await db.message.updateMany({
      where: {
        id: { in: pendingMessages.map((message) => message.id) }
      },
      data: { status: "delivered" }
    });
    return {
      count: pendingMessages.length,
      senderIds: Array.from(new Set(pendingMessages.map((message) => message.fromId)))
    };
  }
};

// src/server/services/admin.service.ts
var safeMember = (member) => ({ ...member, user: member.user ? publicUserDto(member.user) : member.user });
var safeGroup = (group) => ({
  ...group,
  creator: group.creator ? publicUserDto(group.creator) : group.creator,
  members: Array.isArray(group.members) ? group.members.map(safeMember) : group.members
});
var safeMessage2 = (message) => ({
  ...message,
  from: message.from ? publicUserDto(message.from) : message.from
});
var adminService = {
  getStats: async () => {
    const totalUsers = await userRepository.count();
    const totalGroups = await groupRepository.count();
    const totalMessages = await messageRepository.count();
    return { totalUsers, totalGroups, totalMessages };
  },
  getUsers: async () => {
    const users = await userRepository.findMany({ orderBy: { createdAt: "desc" } });
    return users.map(adminUserDto);
  },
  updateUserRole: async (id, role) => {
    return userRepository.update(id, { role }).then(adminUserDto);
  },
  deleteUser: async (id) => {
    return userRepository.deleteWithRelations(id);
  },
  getGroups: async () => {
    const groups = await groupRepository.findMany({
      include: {
        creator: true,
        members: { include: { user: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return groups.map(safeGroup);
  },
  deleteGroup: async (id) => {
    return groupRepository.deleteWithRelations(id);
  },
  getMessages: async () => {
    const messages = await messageRepository.findMany({
      include: { from: true, toGroup: true },
      orderBy: { timestamp: "desc" },
      take: 100
    });
    return messages.map(safeMessage2);
  },
  deleteMessage: async (id) => {
    return messageRepository.delete(id);
  }
};

// src/server/controllers/admin.controller.ts
init_user_repository();
var adminController = {
  getStats: async (req, res) => {
    try {
      const stats = await adminService.getStats();
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  },
  getUsers: async (req, res) => {
    try {
      const users = await adminService.getUsers();
      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  },
  updateUserRole: async (req, res) => {
    try {
      const { role } = req.body;
      const targetUserId = req.params.id;
      const requesterRole = req.userRole;
      const targetUser = await userRepository.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (requesterRole !== "owner") {
        if (role === "admin" || role === "owner" || targetUser.role === "admin" || targetUser.role === "owner") {
          return res.status(403).json({ error: "Permission denied: Only the Nexa Owner can manage admin or owner roles" });
        }
      }
      const updated = await adminService.updateUserRole(targetUserId, role);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update user role" });
    }
  },
  deleteUser: async (req, res) => {
    try {
      const targetUserId = req.params.id;
      const requesterRole = req.userRole;
      if (targetUserId === req.userId) {
        return res.status(400).json({ error: "Cannot delete yourself" });
      }
      const targetUser = await userRepository.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (requesterRole !== "owner") {
        if (targetUser.role === "admin" || targetUser.role === "owner") {
          return res.status(403).json({ error: "Permission denied: Only the Nexa Owner can delete admins or owners" });
        }
      }
      await adminService.deleteUser(targetUserId);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete user" });
    }
  },
  getGroups: async (req, res) => {
    try {
      const groups = await adminService.getGroups();
      res.json(groups);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  },
  deleteGroup: async (req, res) => {
    try {
      await adminService.deleteGroup(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete group" });
    }
  },
  getMessages: async (req, res) => {
    try {
      const messages = await adminService.getMessages();
      res.json(messages);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  },
  deleteMessage: async (req, res) => {
    try {
      await adminService.deleteMessage(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete message" });
    }
  }
};

// src/server/controllers/push.controller.ts
init_db();
var pushController = {
  registerToken: async (req, res) => {
    try {
      const { token, subscription, platform } = req.body;
      const pushToken = typeof subscription === "string" ? subscription : subscription ? JSON.stringify(subscription) : token;
      if (!pushToken) {
        res.status(400).json({ error: "Token is required" });
        return;
      }
      const userId = req.userId;
      await db.pushToken.upsert({
        where: { token: pushToken },
        update: { userId, platform: platform || "android" },
        create: { token: pushToken, userId, platform: platform || "android" }
      });
      res.json({ success: true, message: "Push token registered successfully" });
    } catch (err) {
      console.error("[PUSH_ERR] Failed to register token:", err);
      res.status(500).json({ error: err.message || "Failed to register push token" });
    }
  },
  unregisterToken: async (req, res) => {
    try {
      const { token, subscription } = req.body;
      const pushToken = typeof subscription === "string" ? subscription : subscription ? JSON.stringify(subscription) : token;
      if (!pushToken) {
        res.status(400).json({ error: "Token is required" });
        return;
      }
      await db.pushToken.deleteMany({
        where: { token: pushToken, userId: req.userId }
      });
      res.json({ success: true, message: "Push token unregistered successfully" });
    } catch (err) {
      console.error("[PUSH_ERR] Failed to unregister token:", err);
      res.status(500).json({ error: err.message || "Failed to unregister push token" });
    }
  }
};

// src/server/middlewares/admin.middleware.ts
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"), 1);
init_user_repository();
var authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = import_jsonwebtoken2.default.verify(token, getJwtSecret());
    const user = await userRepository.findById(decoded.userId);
    if (!user || user.role !== "admin" && user.role !== "owner") {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    req.userId = decoded.userId;
    req.userRole = user.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

// src/server/middlewares/auth.middleware.ts
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"), 1);
init_user_repository();
var authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = import_jsonwebtoken3.default.verify(token, getJwtSecret());
    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

// src/server/socket/message.handler.ts
init_chat_state_repository();

// src/server/validations/message.schema.ts
var import_zod3 = require("zod");
var sendMessageSchema = import_zod3.z.object({
  to: import_zod3.z.string().min(1, "Recipient ID is required"),
  text: import_zod3.z.string().max(2e3, "Message is too long").optional(),
  type: import_zod3.z.enum(["text", "image", "audio", "video", "sticker", "file"]).optional(),
  data: import_zod3.z.string().optional(),
  replyToId: import_zod3.z.string().optional()
});
var messageHistorySchema = import_zod3.z.object({
  chatId: import_zod3.z.string().min(1)
});
var messageReactionSchema = import_zod3.z.object({
  messageId: import_zod3.z.string().min(1),
  emoji: import_zod3.z.string().min(1).max(10)
});
var messagePinSchema = import_zod3.z.object({
  messageId: import_zod3.z.string().min(1),
  isPinned: import_zod3.z.boolean()
});
var messageSearchSchema = import_zod3.z.object({
  chatId: import_zod3.z.string().min(1),
  query: import_zod3.z.string().min(1)
});

// src/server/socket/message.handler.ts
var import_zod4 = require("zod");

// src/server/services/push.service.ts
var import_web_push = __toESM(require("web-push"), 1);
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
init_db();
var DEFAULT_VAPID_SUBJECT = "mailto:admin@nexa.local";
var vapidConfigured = false;
var firebaseConfigured = false;
function ensureVapidConfig() {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;
  if (!publicKey || !privateKey || publicKey === "CHANGE_ME" || privateKey === "CHANGE_ME") {
    return false;
  }
  import_web_push.default.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}
function parseSubscriptionToken(token) {
  try {
    const parsed = JSON.parse(token);
    if (parsed && typeof parsed === "object" && parsed.endpoint) {
      return parsed;
    }
  } catch {
  }
  return null;
}
async function removeExpiredToken(token) {
  await db.pushToken.deleteMany({ where: { token } }).catch(() => {
  });
}
function ensureFirebaseConfig() {
  if (firebaseConfigured) return import_firebase_admin.default.apps.length > 0;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (import_firebase_admin.default.apps.length > 0) {
    firebaseConfigured = true;
    return true;
  }
  try {
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      import_firebase_admin.default.initializeApp({
        credential: import_firebase_admin.default.credential.cert(serviceAccount)
      });
      firebaseConfigured = true;
      return true;
    }
    if (projectId && clientEmail && privateKey) {
      import_firebase_admin.default.initializeApp({
        credential: import_firebase_admin.default.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n")
        })
      });
      firebaseConfigured = true;
      return true;
    }
  } catch (error) {
    console.warn("[PUSH] Firebase admin init failed:", error);
  }
  firebaseConfigured = false;
  return false;
}
async function sendFcmNotification(token, payload) {
  if (!ensureFirebaseConfig()) return;
  const message = {
    token,
    notification: {
      title: payload.title,
      body: payload.body
    },
    data: {
      url: payload.url || "/",
      kind: payload.kind || "message",
      chatId: payload.chatId || "",
      fromId: payload.fromId || "",
      fromName: payload.fromName || ""
    },
    android: {
      priority: "high",
      notification: {
        channelId: payload.kind === "call" ? "calls" : "messages"
      }
    }
  };
  try {
    await import_firebase_admin.default.messaging().send(message);
  } catch (error) {
    const code = String(error?.errorInfo?.code || error?.code || "");
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
      await removeExpiredToken(token);
      return;
    }
    console.error("[PUSH_ERR] Failed to send FCM notification:", error);
  }
}
async function sendPushToUser(userId, payload) {
  const canSendWebPush = ensureVapidConfig();
  const tokens = await db.pushToken.findMany({ where: { userId } });
  if (!tokens.length) return;
  const body = JSON.stringify({
    ...payload,
    url: payload.url || "/"
  });
  for (const record of tokens) {
    if (record.platform === "web" || record.token.trim().startsWith("{")) {
      if (!canSendWebPush) continue;
      const subscription = parseSubscriptionToken(record.token);
      if (!subscription) continue;
      try {
        await import_web_push.default.sendNotification(subscription, body);
      } catch (error) {
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removeExpiredToken(record.token);
          continue;
        }
        console.error("[PUSH_ERR] Failed to send push notification:", error);
      }
      continue;
    }
    if (record.platform === "android" || record.platform === "ios") {
      await sendFcmNotification(record.token, payload);
    }
  }
}
async function sendPushToMany(userIds, payload) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  await Promise.all(uniqueUserIds.map((userId) => sendPushToUser(userId, payload)));
}

// src/server/socket/message.handler.ts
var buildMessagePreview = (type, text, data) => {
  if (type === "image") return "\u0424\u043E\u0442\u043E";
  if (type === "video") return "\u0412\u0438\u0434\u0435\u043E";
  if (type === "audio") return "\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435";
  if (type === "sticker") return "\u0421\u0442\u0438\u043A\u0435\u0440";
  const trimmed = (text || "").trim();
  if (trimmed) return trimmed.slice(0, 120);
  if (data) return "\u041C\u0435\u0434\u0438\u0430";
  return "\u041D\u043E\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435";
};
var handleMessages = (io, socket, onlineUsers) => {
  const userId = socket.userId;
  const emitChatState = async (targetUserId, chatId, chatType) => {
    const targetSocket = onlineUsers.get(targetUserId)?.socketId;
    if (!targetSocket) return;
    const states = await chatStateRepository.findForUser(targetUserId);
    io.to(targetSocket).emit("chat:states", states);
  };
  const chatStateTargetSchema = import_zod4.z.object({
    chatId: import_zod4.z.string().min(1),
    chatType: import_zod4.z.enum(["direct", "group", "channel"])
  });
  const updateChatPreferences = async (chatId, chatType, data) => {
    await chatStateRepository.updatePreferences(userId, chatId, chatType, data);
    socket.emit("chat:states", await chatStateRepository.findForUser(userId));
  };
  const isGroupMember = async (groupId) => {
    const group = await groupRepository.findById(groupId, true);
    if (!group) return { allowed: false, group: null };
    return {
      allowed: group.members.some((member) => member.userId === userId),
      group
    };
  };
  const canAccessMessage = async (messageId) => {
    const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const message = await db2.message.findUnique({ where: { id: messageId } });
    if (!message) return { allowed: false, message: null };
    if (message.fromId === userId || message.toUserId === userId) {
      return { allowed: true, message };
    }
    if (message.toGroupId) {
      const access = await isGroupMember(message.toGroupId);
      return { allowed: access.allowed, message };
    }
    return { allowed: false, message };
  };
  socket.on("message:history", async (payload) => {
    try {
      const { chatId } = messageHistorySchema.parse(payload);
      const group = await groupRepository.findById(chatId);
      const isGroup = !!group;
      if (isGroup) {
        const access = await isGroupMember(chatId);
        if (!access.allowed) {
          socket.emit("error", { message: "Access denied" });
          return;
        }
      }
      const messages = await (isGroup ? messageRepository.getHistoryForGroup(chatId) : messageRepository.getHistoryForDirectMessage(userId, chatId));
      socket.emit("message:history:result", { chatId, messages: messages.reverse() });
    } catch (err) {
      console.error("[DB_ERR] History fetch failed:", err);
    }
  });
  socket.on("message:send", async (payload) => {
    try {
      const data = sendMessageSchema.parse(payload);
      const { to, text, type, data: mediaData, replyToId } = data;
      const group = await groupRepository.findById(to);
      const isGroup = !!group;
      if (isGroup) {
        const access = await isGroupMember(to);
        if (!access.allowed) {
          socket.emit("error", { message: "Access denied" });
          return;
        }
      }
      const directRecipientSocket = !isGroup ? onlineUsers.get(to)?.socketId : null;
      const dbMsg = await messageRepository.create({
        text: text || "",
        type: type || "text",
        data: mediaData,
        fromId: userId,
        toGroupId: isGroup ? to : null,
        toUserId: !isGroup ? to : null,
        replyToId,
        status: !isGroup && directRecipientSocket ? "delivered" : "sent"
      }, true);
      if (isGroup) {
        const groupWithMembers = await groupRepository.findById(to, true);
        if (groupWithMembers) {
          const enrichedGroupMsg = { ...dbMsg, toGroupId: to };
          await Promise.all(groupWithMembers.members.map(async (m) => {
            if (m.userId === userId) {
              await chatStateRepository.touch(m.userId, to, "group");
            } else {
              await chatStateRepository.incrementUnread(m.userId, to, "group");
            }
            const mSocket = onlineUsers.get(m.userId)?.socketId;
            if (mSocket) io.to(mSocket).emit("message:new", enrichedGroupMsg);
            await emitChatState(m.userId, to, "group");
          }));
          const offlineMemberIds = groupWithMembers.members.filter((member) => member.userId !== userId && !onlineUsers.get(member.userId)?.socketId).map((member) => member.userId);
          if (offlineMemberIds.length > 0) {
            const senderName = onlineUsers.get(userId)?.nickname || onlineUsers.get(userId)?.username || "Nexa";
            await sendPushToMany(offlineMemberIds, {
              title: groupWithMembers.name,
              body: `${senderName}: ${buildMessagePreview(type || "text", text, mediaData)}`,
              kind: "message",
              chatId: to,
              fromId: userId,
              fromName: senderName,
              url: "/"
            });
          }
        }
      } else {
        const recipientSocket = onlineUsers.get(to)?.socketId;
        await chatStateRepository.touch(userId, to, "direct");
        await chatStateRepository.incrementUnread(to, userId, "direct");
        await emitChatState(userId, to, "direct");
        await emitChatState(to, userId, "direct");
        if (recipientSocket) io.to(recipientSocket).emit("message:new", dbMsg);
        if (!recipientSocket && to !== userId) {
          const senderName = onlineUsers.get(userId)?.nickname || onlineUsers.get(userId)?.username || "Nexa";
          await sendPushToUser(to, {
            title: senderName,
            body: buildMessagePreview(type || "text", text, mediaData),
            kind: "message",
            chatId: to,
            fromId: userId,
            fromName: senderName,
            url: "/"
          });
        }
        if (to !== userId) {
          socket.emit("message:new", dbMsg);
        }
      }
    } catch (err) {
      console.error("[DB_ERR] Message send failed:", err);
    }
  });
  socket.on("message:react", async (payload) => {
    try {
      const { messageId, emoji } = messageReactionSchema.parse(payload);
      const access = await canAccessMessage(messageId);
      if (!access.allowed) return;
      const updatedMsg = await messageRepository.toggleReaction(messageId, userId, emoji);
      if (updatedMsg) {
        if (updatedMsg.toGroupId) {
          const group = await groupRepository.findById(updatedMsg.toGroupId, true);
          if (group) {
            group.members.forEach((m) => {
              const mSocket = onlineUsers.get(m.userId)?.socketId;
              if (mSocket) io.to(mSocket).emit("message:updated", updatedMsg);
            });
          }
        } else {
          const recipientId = updatedMsg.toUserId === userId ? updatedMsg.fromId : updatedMsg.toUserId;
          if (recipientId) {
            const recipientSocket = onlineUsers.get(recipientId)?.socketId;
            if (recipientSocket) io.to(recipientSocket).emit("message:updated", updatedMsg);
          }
          socket.emit("message:updated", updatedMsg);
        }
      }
    } catch (e) {
      console.error("Reaction error:", e);
    }
  });
  socket.on("message:pin", async (payload) => {
    try {
      const { messageId, isPinned } = messagePinSchema.parse(payload);
      const access = await canAccessMessage(messageId);
      if (!access.allowed) return;
      const updatedMsg = await messageRepository.pinMessage(messageId, isPinned);
      if (updatedMsg) {
        if (updatedMsg.toGroupId) {
          const group = await groupRepository.findById(updatedMsg.toGroupId, true);
          if (group) {
            group.members.forEach((m) => {
              const mSocket = onlineUsers.get(m.userId)?.socketId;
              if (mSocket) io.to(mSocket).emit("message:updated", updatedMsg);
            });
          }
        } else {
          const recipientId = updatedMsg.toUserId === userId ? updatedMsg.fromId : updatedMsg.toUserId;
          if (recipientId) {
            const recipientSocket = onlineUsers.get(recipientId)?.socketId;
            if (recipientSocket) io.to(recipientSocket).emit("message:updated", updatedMsg);
          }
          socket.emit("message:updated", updatedMsg);
        }
      }
    } catch (e) {
      console.error("Pin error:", e);
    }
  });
  socket.on("message:search", async (payload) => {
    try {
      const { chatId, query } = messageSearchSchema.parse(payload);
      const group = await groupRepository.findById(chatId);
      const isGroup = !!group;
      if (isGroup) {
        const access = await isGroupMember(chatId);
        if (!access.allowed) {
          socket.emit("error", { message: "Access denied" });
          return;
        }
      }
      const results = await messageRepository.searchMessages(userId, chatId, query, isGroup);
      socket.emit("message:search:result", { chatId, results });
    } catch (e) {
      console.error("Search error:", e);
    }
  });
  socket.on("message:read", async (payload) => {
    try {
      const { chatId } = import_zod4.z.object({ chatId: import_zod4.z.string() }).parse(payload);
      const group = await groupRepository.findById(chatId);
      const chatType = group ? "group" : "direct";
      await messageRepository.markAsRead(chatId, userId);
      await chatStateRepository.markRead(userId, chatId, chatType);
      await emitChatState(userId, chatId, chatType);
      const senderSocket = onlineUsers.get(chatId)?.socketId;
      if (senderSocket) {
        io.to(senderSocket).emit("messages:read", { chatId: userId });
      }
    } catch (err) {
      console.error("message:read error:", err);
    }
  });
  socket.on("chat:state:update", async (payload) => {
    try {
      const data = import_zod4.z.object({
        chatId: import_zod4.z.string().min(1),
        chatType: import_zod4.z.enum(["direct", "group", "channel"]),
        pinned: import_zod4.z.boolean().optional(),
        archived: import_zod4.z.boolean().optional(),
        mutedUntil: import_zod4.z.string().datetime().nullable().optional()
      }).parse(payload);
      const mutedUntil = data.mutedUntil === void 0 ? void 0 : data.mutedUntil ? new Date(data.mutedUntil) : null;
      await updateChatPreferences(data.chatId, data.chatType, {
        pinned: data.pinned,
        archived: data.archived,
        mutedUntil
      });
    } catch (err) {
      console.error("chat:state:update error:", err);
    }
  });
  socket.on("chat:pin", async (payload) => {
    try {
      const data = chatStateTargetSchema.extend({
        pinned: import_zod4.z.boolean()
      }).parse(payload);
      await updateChatPreferences(data.chatId, data.chatType, { pinned: data.pinned });
    } catch (err) {
      console.error("chat:pin error:", err);
    }
  });
  socket.on("chat:archive", async (payload) => {
    try {
      const data = chatStateTargetSchema.extend({
        archived: import_zod4.z.boolean()
      }).parse(payload);
      await updateChatPreferences(data.chatId, data.chatType, { archived: data.archived });
    } catch (err) {
      console.error("chat:archive error:", err);
    }
  });
  socket.on("chat:mute", async (payload) => {
    try {
      const data = chatStateTargetSchema.extend({
        mutedUntil: import_zod4.z.string().datetime().nullable().optional(),
        muted: import_zod4.z.boolean().optional(),
        durationMs: import_zod4.z.number().int().positive().max(30 * 24 * 60 * 60 * 1e3).optional()
      }).parse(payload);
      const mutedUntil = data.mutedUntil !== void 0 ? data.mutedUntil ? new Date(data.mutedUntil) : null : data.muted === false ? null : new Date(Date.now() + (data.durationMs || 60 * 60 * 1e3));
      await updateChatPreferences(data.chatId, data.chatType, { mutedUntil });
    } catch (err) {
      console.error("chat:mute error:", err);
    }
  });
  socket.on("typing", async (payload) => {
    try {
      if (!payload || typeof payload !== "object") return;
      const { chatId, isTyping } = payload;
      if (!chatId) return;
      const user = onlineUsers.get(userId);
      const userName = user?.nickname || user?.username || "\u0421\u043E\u0431\u0435\u0441\u0435\u0434\u043D\u0438\u043A";
      const group = await groupRepository.findById(chatId, true);
      const isGroup = !!group;
      if (isGroup) {
        group.members.forEach((m) => {
          if (m.userId !== userId) {
            const mSocket = onlineUsers.get(m.userId)?.socketId;
            if (mSocket) {
              io.to(mSocket).emit("typing:update", {
                chatId,
                userId,
                userName,
                isTyping
              });
            }
          }
        });
      } else {
        const recipientSocket = onlineUsers.get(chatId)?.socketId;
        if (recipientSocket) {
          io.to(recipientSocket).emit("typing:update", {
            chatId: userId,
            userId,
            userName,
            isTyping
          });
        }
      }
    } catch (err) {
      console.error("[TYPING_ERR] Error handling typing event:", err);
    }
  });
  socket.on("message:edit", async (payload) => {
    try {
      const { messageId, text } = payload;
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const message = await db2.message.findUnique({ where: { id: messageId } });
      if (!message || message.fromId !== userId) return;
      if ((message.text || "").startsWith("[E2EE]")) {
        socket.emit("message:edit:error", {
          messageId,
          error: "Encrypted messages cannot be edited yet"
        });
        return;
      }
      const updatedMsg = safeMessage(await db2.message.update({
        where: { id: messageId },
        data: { text: text || "", isEdited: true },
        include: { from: true, replyTo: { include: { from: true } }, reactions: true }
      }));
      if (updatedMsg.toGroupId) {
        const group = await groupRepository.findById(updatedMsg.toGroupId, true);
        if (group) {
          group.members.forEach((m) => {
            const mSocket = onlineUsers.get(m.userId)?.socketId;
            if (mSocket) io.to(mSocket).emit("message:updated", updatedMsg);
          });
        }
      } else {
        const recipientId = updatedMsg.toUserId === userId ? updatedMsg.fromId : updatedMsg.toUserId;
        if (recipientId) {
          const recipientSocket = onlineUsers.get(recipientId)?.socketId;
          if (recipientSocket) io.to(recipientSocket).emit("message:updated", updatedMsg);
        }
        socket.emit("message:updated", updatedMsg);
      }
    } catch (err) {
      console.error("[DB_ERR] Message edit failed:", err);
    }
  });
  socket.on("message:delete", async (payload) => {
    try {
      const { messageId } = payload;
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const message = await db2.message.findUnique({ where: { id: messageId } });
      if (!message) return;
      let canDelete = message.fromId === userId;
      if (!canDelete && message.toGroupId) {
        const group = await groupRepository.findById(message.toGroupId, true);
        if (group) {
          const memberRelation = group.members.find((m) => m.userId === userId);
          canDelete = group.creatorId === userId || memberRelation?.isCoOwner === true;
        }
      }
      if (!canDelete) return;
      await db2.$transaction([
        db2.reaction.deleteMany({ where: { messageId } }),
        db2.message.updateMany({ where: { replyToId: messageId }, data: { replyToId: null } }),
        db2.message.delete({ where: { id: messageId } })
      ]);
      const deletePayload = { messageId, toGroupId: message.toGroupId, toUserId: message.toUserId, fromId: message.fromId };
      if (message.toGroupId) {
        const group = await groupRepository.findById(message.toGroupId, true);
        if (group) {
          group.members.forEach((m) => {
            const mSocket = onlineUsers.get(m.userId)?.socketId;
            if (mSocket) io.to(mSocket).emit("message:deleted", deletePayload);
          });
        }
      } else {
        const recipientId = message.toUserId === userId ? message.fromId : message.toUserId;
        if (recipientId) {
          const recipientSocket = onlineUsers.get(recipientId)?.socketId;
          if (recipientSocket) io.to(recipientSocket).emit("message:deleted", deletePayload);
        }
        socket.emit("message:deleted", deletePayload);
      }
    } catch (err) {
      console.error("[DB_ERR] Message delete failed:", err);
    }
  });
};

// src/server/validations/group.schema.ts
var import_zod5 = require("zod");
var createGroupSchema = import_zod5.z.object({
  name: import_zod5.z.string().min(1, "Group name is required").max(50),
  description: import_zod5.z.string().optional(),
  isPublic: import_zod5.z.boolean().optional(),
  members: import_zod5.z.array(import_zod5.z.string()).optional()
});
var updateGroupSchema = import_zod5.z.object({
  id: import_zod5.z.string().min(1),
  name: import_zod5.z.string().min(1).max(50),
  description: import_zod5.z.string().optional(),
  isPublic: import_zod5.z.boolean().optional(),
  avatarImage: import_zod5.z.string().nullable().optional()
});
var createChannelSchema = import_zod5.z.object({
  name: import_zod5.z.string().min(1, "Channel name is required").max(50),
  description: import_zod5.z.string().optional(),
  isPublic: import_zod5.z.boolean().optional()
});
var updateChannelSchema = import_zod5.z.object({
  id: import_zod5.z.string().min(1),
  name: import_zod5.z.string().min(1).max(50),
  description: import_zod5.z.string().optional(),
  isPublic: import_zod5.z.boolean().optional(),
  avatarImage: import_zod5.z.string().nullable().optional()
});

// src/utils/avatarGenerator.ts
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return Math.abs(hash);
}
function encodeBase64(str) {
  try {
    if (typeof window !== "undefined" && typeof window.btoa === "function") {
      return "data:image/svg+xml;base64," + window.btoa(unescape(encodeURIComponent(str)));
    }
  } catch (e) {
  }
  try {
    if (typeof Buffer !== "undefined") {
      return "data:image/svg+xml;base64," + Buffer.from(str).toString("base64");
    }
  } catch (e) {
  }
  return "data:image/svg+xml;utf8," + encodeURIComponent(str);
}
function generateGroupAvatar(groupName) {
  const name = (groupName || "Group").trim() || "Group";
  const hash = hashString(name);
  const layoutStyle = hash % 5;
  const h1 = hash % 360;
  const s1 = 65 + hash % 15;
  const l1 = 40 + hash % 12;
  const h2 = (h1 + 80 + hash % 100) % 360;
  const s2 = 70 + hash % 15;
  const l2 = 35 + hash % 12;
  const hAccent = (h1 + 180) % 360;
  const sAccent = 80 + hash % 15;
  const lAccent = 50 + hash % 10;
  const color1 = `hsl(${h1}, ${s1}%, ${l1}%)`;
  const color2 = `hsl(${h2}, ${s2}%, ${l2}%)`;
  const colorAccent = `hsl(${hAccent}, ${sAccent}%, ${lAccent}%)`;
  const hBg = (h1 + 150) % 360;
  const sBg = 25 + hash % 15;
  const lBg = 12 + hash % 8;
  const bgColor = `hsl(${hBg}, ${sBg}%, ${lBg}%)`;
  let shapesSvg = "";
  switch (layoutStyle) {
    case 0: {
      const r1 = 45 + hash % 15;
      const r2 = 35 + hash % 10;
      const rAccent = 22 + hash % 8;
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <circle cx="100" cy="100" r="85" fill="none" stroke="${color1}" stroke-width="4" opacity="0.12" />
        <circle cx="72" cy="72" r="${r1}" fill="${color1}" opacity="0.75" />
        <circle cx="128" cy="128" r="${r2}" fill="${color2}" opacity="0.8" style="mix-blend-mode: screen;" />
        <circle cx="100" cy="100" r="${rAccent}" fill="${colorAccent}" />
        <circle cx="100" cy="100" r="${rAccent / 2}" fill="${bgColor}" />
      `;
      break;
    }
    case 1: {
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <g opacity="0.9">
          <rect x="25" y="25" width="70" height="150" rx="16" fill="${color1}" opacity="0.7" />
          <rect x="105" y="25" width="70" height="70" rx="35" fill="${colorAccent}" />
          <rect x="105" y="105" width="70" height="70" rx="16" fill="${color2}" opacity="0.8" />
          <circle cx="60" cy="100" r="18" fill="${bgColor}" />
          <line x1="25" y1="100" x2="175" y2="100" stroke="${colorAccent}" stroke-width="4" opacity="0.5" stroke-dasharray="8 8" />
        </g>
      `;
      break;
    }
    case 2: {
      const radius = 25 + hash % 15;
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <g opacity="0.85">
          <circle cx="100" cy="100" r="80" fill="none" stroke="${color1}" stroke-width="3" stroke-dasharray="14 8" />
          <circle cx="100" cy="100" r="55" fill="none" stroke="${color2}" stroke-width="10" opacity="0.4" />
          <circle cx="100" cy="100" r="${radius}" fill="${colorAccent}" />
          <polygon points="100,10 115,75 190,100 115,125 100,190 85,125 10,100 85,75" fill="${color1}" opacity="0.65" style="mix-blend-mode: color-dodge;" />
          <circle cx="100" cy="100" r="10" fill="${bgColor}" />
        </g>
      `;
      break;
    }
    case 3: {
      const baseline = 155;
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <g opacity="0.9">
          <polygon points="40,${baseline} 100,35 160,${baseline}" fill="${color2}" opacity="0.75" />
          <polygon points="15,${baseline} 80,65 145,${baseline}" fill="${color1}" opacity="0.6" style="mix-blend-mode: screen;" />
          <circle cx="100" cy="85" r="24" fill="${colorAccent}" />
          <circle cx="100" cy="85" r="12" fill="${bgColor}" />
          <line x1="20" y1="${baseline}" x2="180" y2="${baseline}" stroke="${colorAccent}" stroke-width="6" stroke-linecap="round" />
        </g>
      `;
      break;
    }
    case 4: {
      shapesSvg = `
        <rect width="200" height="200" fill="${bgColor}" rx="48" />
        <g opacity="0.9">
          <!-- Horizon Grid Lines -->
          <line x1="10" y1="130" x2="190" y2="130" stroke="${color1}" stroke-width="2" opacity="0.4" />
          <line x1="10" y1="145" x2="190" y2="145" stroke="${color1}" stroke-width="3" opacity="0.5" />
          <line x1="10" y1="160" x2="190" y2="160" stroke="${color1}" stroke-width="4" opacity="0.6" />
          
          <!-- Sun Semicircle -->
          <path d="M 50,110 A 50,50 0 0,1 150,110 Z" fill="${colorAccent}" opacity="0.85" />
          
          <!-- Abstract Diagonal Pillars -->
          <rect x="40" y="40" width="20" height="120" rx="10" transform="rotate(30 40 40)" fill="${color1}" opacity="0.7" style="mix-blend-mode: screen;" />
          <rect x="140" y="-30" width="20" height="120" rx="10" transform="rotate(30 140 -30)" fill="${color2}" opacity="0.8" style="mix-blend-mode: screen;" />
          
          <!-- Glowing center point -->
          <circle cx="100" cy="110" r="15" fill="${color2}" />
        </g>
      `;
      break;
    }
  }
  const outerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${shapesSvg}</svg>`;
  return encodeBase64(outerSvg);
}

// src/server/socket/group.handler.ts
var safeGroupMember = (member) => ({ ...member, user: member.user ? safeUser(member.user) : member.user });
var safeGroupPayload = (group) => ({
  ...group,
  creator: group.creator ? safeUser(group.creator) : group.creator,
  members: Array.isArray(group.members) ? group.members.map(safeGroupMember) : group.members
});
var handleGroups = (io, socket, onlineUsers) => {
  const userId = socket.userId;
  const canManageGroup = async (groupId) => {
    const group = await groupRepository.findById(groupId, true);
    if (!group) return { allowed: false, group: null };
    const member = group.members.find((m) => m.userId === userId);
    return {
      allowed: group.creatorId === userId || member?.role === "owner" || member?.role === "admin" || member?.isCoOwner === true,
      group
    };
  };
  socket.on("group:create", async (payload) => {
    try {
      const { name, description, isPublic, members } = createGroupSchema.parse(payload);
      const membersArray = members || [];
      const uniqueMemberIds = Array.from(new Set(membersArray)).filter((id) => id !== userId);
      const generatedAvatar = generateGroupAvatar(name);
      const newGroup = await groupRepository.create({
        name,
        description,
        isPublic: isPublic || false,
        creatorId: userId,
        avatarColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
        avatarImage: generatedAvatar,
        initials: name.substring(0, 2).toUpperCase(),
        members: {
          create: [
            { userId, role: "owner", isCoOwner: true },
            ...uniqueMemberIds.map((mId) => ({ userId: mId, role: "member" }))
          ]
        }
      }, true);
      newGroup.members.forEach((m) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit("group:new", { ...safeGroupPayload(newGroup), isGroup: true });
      });
    } catch (err) {
      console.error("[DB_ERR] Group creation failed:", err);
    }
  });
  socket.on("group:update", async (payload) => {
    try {
      const { id, name, avatarImage } = updateGroupSchema.parse(payload);
      const access = await canManageGroup(id);
      if (!access.allowed) {
        socket.emit("error", { message: "Access denied" });
        return;
      }
      const updatedGroup = await groupRepository.update(id, {
        name,
        avatarImage,
        initials: name ? name.substring(0, 2).toUpperCase() : void 0
      }, true);
      updatedGroup.members.forEach((m) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit("group:updated", { ...safeGroupPayload(updatedGroup), isGroup: true });
      });
    } catch (err) {
      console.error("[DB_ERR] Group update failed:", err);
    }
  });
  socket.on("group:add-member", async (payload) => {
    try {
      const { groupId, userId: targetUserId } = payload;
      if (typeof groupId !== "string" || typeof targetUserId !== "string") return;
      const access = await canManageGroup(groupId);
      if (!access.allowed) {
        socket.emit("error", { message: "Access denied" });
        return;
      }
      await groupRepository.addMember(groupId, targetUserId);
      const updatedGroup = await groupRepository.findById(groupId, true);
      if (updatedGroup) {
        updatedGroup.members.forEach((m) => {
          const mSocket = onlineUsers.get(m.userId)?.socketId;
          if (mSocket) io.to(mSocket).emit("group:updated", { ...safeGroupPayload(updatedGroup), isGroup: true });
        });
      }
    } catch (err) {
      console.error("[DB_ERR] Add group member failed:", err);
    }
  });
  socket.on("group:delete", async (payload) => {
    try {
      const { groupId } = payload;
      if (typeof groupId !== "string") return;
      const access = await canManageGroup(groupId);
      if (!access.allowed || !access.group) {
        socket.emit("error", { message: "Access denied" });
        return;
      }
      const members = access.group.members || [];
      await groupRepository.deleteWithRelations(groupId);
      members.forEach((m) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit("group:deleted", { groupId });
      });
    } catch (err) {
      console.error("[DB_ERR] Group delete failed:", err);
    }
  });
};

// src/server/socket/call.handler.ts
var safeCallUserPayload = (user) => publicUserDto(user);
var handleCalls = (io, socket, onlineUsers) => {
  const userId = socket.userId;
  socket.on("call:initiate", (payload) => {
    const { to, type } = payload;
    const sender = onlineUsers.get(userId);
    const callerName = sender?.nickname || sender?.username || "Nexa";
    if (sender) {
      const recipientSocket = onlineUsers.get(to)?.socketId;
      if (recipientSocket) {
        io.to(recipientSocket).emit("call:incoming", { from: safeCallUserPayload(sender), type });
      } else {
        void sendPushToUser(to, {
          title: `@${callerName} \u0437\u0432\u043E\u043D\u0438\u0442`,
          body: type === "video" ? "\u0412\u0445\u043E\u0434\u044F\u0449\u0438\u0439 \u0432\u0438\u0434\u0435\u043E\u0437\u0432\u043E\u043D\u043E\u043A" : "\u0412\u0445\u043E\u0434\u044F\u0449\u0438\u0439 \u0437\u0432\u043E\u043D\u043E\u043A",
          kind: "call",
          fromId: userId,
          fromName: callerName,
          url: "/"
        });
      }
    }
  });
  socket.on("call:accept", (payload) => {
    const { to } = payload;
    const recipientSocket = onlineUsers.get(to)?.socketId;
    if (recipientSocket) io.to(recipientSocket).emit("call:accepted", { fromId: userId });
  });
  socket.on("call:reject", (payload) => {
    const { to } = payload;
    const recipientSocket = onlineUsers.get(to)?.socketId;
    if (recipientSocket) io.to(recipientSocket).emit("call:rejected", { fromId: userId });
  });
  socket.on("call:signal", (payload) => {
    const { to, signal } = payload;
    const recipientSocket = onlineUsers.get(to)?.socketId;
    if (recipientSocket) io.to(recipientSocket).emit("call:signal", { fromId: userId, signal });
  });
  socket.on("call:end", (payload) => {
    const { to } = payload;
    const recipientSocket = onlineUsers.get(to)?.socketId;
    if (recipientSocket) io.to(recipientSocket).emit("call:ended");
  });
};

// src/server/socket/user.handler.ts
init_user_repository();
var import_zod6 = require("zod");
var profileUpdateSchema = import_zod6.z.object({
  nickname: import_zod6.z.string().min(2).optional(),
  avatarColor: import_zod6.z.string().optional(),
  avatarImage: import_zod6.z.string().nullable().optional(),
  bio: import_zod6.z.string().optional(),
  phoneNumber: import_zod6.z.string().max(32).nullable().optional(),
  firstName: import_zod6.z.string().nullable().optional(),
  lastName: import_zod6.z.string().nullable().optional(),
  dateOfBirth: import_zod6.z.string().nullable().optional(),
  activityStatus: import_zod6.z.string().nullable().optional(),
  publicKey: import_zod6.z.string().optional()
});
var normalizePhone2 = (phone) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) return `7${digits.slice(1)}`;
  return digits;
};
var safeMember2 = (member) => ({
  ...member,
  user: member.user ? publicUserDto(member.user) : member.user
});
var safeGroup2 = (group) => ({
  ...group,
  creator: group.creator ? publicUserDto(group.creator) : group.creator,
  owner: group.owner ? publicUserDto(group.owner) : group.owner,
  members: Array.isArray(group.members) ? group.members.map(safeMember2) : group.members
});
var handleUsers = (io, socket, onlineUsers, socketToUserMap) => {
  const userId = socket.userId;
  socket.on("join", async () => {
    try {
      let user = await userRepository.findById(userId);
      if (!user) {
        socket.emit("auth:expired");
        return;
      }
      if (!user.nexaId) {
        const { db: prismaDb } = await Promise.resolve().then(() => (init_db(), db_exports));
        let nexaId = "";
        let isUnique = false;
        while (!isUnique) {
          const randomNum = Math.floor(1e5 + Math.random() * 9e5);
          nexaId = `nexa-${randomNum}`;
          const existingWithId = await prismaDb.user.findFirst({ where: { nexaId } });
          if (!existingWithId) {
            isUnique = true;
          }
        }
        user = await userRepository.update(userId, { nexaId });
      }
      const userData = { ...publicUserDto({ ...user, status: "online" }), socketId: socket.id };
      onlineUsers.set(userId, userData);
      socketToUserMap.set(socket.id, userId);
      const delivered = await messageRepository.markDeliveredToUser(userId);
      delivered.senderIds.forEach((senderId) => {
        const senderSocket = onlineUsers.get(senderId)?.socketId;
        if (senderSocket) {
          io.to(senderSocket).emit("messages:delivered", { chatId: userId });
        }
      });
      io.emit("users:online", publicUsersDto(Array.from(onlineUsers.values())));
      const userGroups = await groupRepository.findForUser(userId);
      const enrichedGroups = userGroups.map((g) => ({ ...safeGroup2(g), isGroup: true }));
      socket.emit("groups:update", enrichedGroups);
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const userChannels = await db2.channel.findMany({
        where: { members: { some: { userId } } },
        include: { members: { include: { user: true } } }
      });
      const enrichedChannels = userChannels.map((c) => ({ ...safeGroup2(c), isChannel: true }));
      socket.emit("channels:update", enrichedChannels);
      const { chatStateRepository: chatStateRepository2 } = await Promise.resolve().then(() => (init_chat_state_repository(), chat_state_repository_exports));
      const directMessages = await db2.message.findMany({
        where: {
          OR: [
            { fromId: userId, toUserId: { not: null } },
            { toUserId: userId }
          ]
        },
        select: { fromId: true, toUserId: true },
        distinct: ["fromId", "toUserId"]
      });
      const directPeerIds = Array.from(new Set(
        directMessages.map((message) => message.fromId === userId ? message.toUserId : message.fromId).filter((peerId) => Boolean(peerId) && peerId !== userId)
      ));
      await Promise.all(directPeerIds.map((peerId) => chatStateRepository2.touch(userId, peerId, "direct")));
      socket.emit("chat:states", await chatStateRepository2.findForUser(userId));
    } catch (err) {
      console.error(err);
    }
  });
  socket.on("profile:update", async (payload) => {
    try {
      const data = profileUpdateSchema.parse(payload);
      const currentUser = await userRepository.findById(userId);
      if (!currentUser) return;
      const updateData = {
        nickname: data.nickname,
        avatarColor: data.avatarColor,
        avatarImage: data.avatarImage,
        bio: data.bio,
        phoneNumber: data.phoneNumber,
        normalizedPhone: data.phoneNumber === void 0 ? void 0 : normalizePhone2(data.phoneNumber),
        activityStatus: data.activityStatus,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        publicKey: data.publicKey,
        initials: data.nickname ? data.nickname.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : void 0
      };
      const updatedUser = await userRepository.update(userId, updateData);
      const safeUpdatedUser = privateUserDto(updatedUser);
      socket.emit("profile:updated", safeUpdatedUser);
      const onlineData = onlineUsers.get(userId);
      if (onlineData) {
        onlineUsers.set(userId, { ...publicUserDto({ ...onlineData, ...updatedUser }), socketId: onlineData.socketId });
        io.emit("users:online", publicUsersDto(Array.from(onlineUsers.values())));
      }
    } catch (err) {
      console.error("[DB_ERR] Profile update failed:", err);
    }
  });
  socket.on("disconnect", () => {
    const uId = socketToUserMap.get(socket.id);
    if (uId) {
      onlineUsers.delete(uId);
      socketToUserMap.delete(socket.id);
      io.emit("users:online", publicUsersDto(Array.from(onlineUsers.values())));
    }
  });
};

// src/server/socket/wallet.handler.ts
init_db();
var handleWallet = (io, socket, onlineUsers) => {
  const userId = socket.userId;
  socket.on("wallet:grant", async (payload) => {
    try {
      const amount = Number(payload?.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1e5) {
        socket.emit("error", { message: "Invalid grant amount" });
        return;
      }
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== "admin") {
        socket.emit("error", { message: "\u041D\u0430 \u0442\u043E \u043D\u0435\u0442 \u043F\u0440\u0430\u0432" });
        return;
      }
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: { balance: { increment: amount } }
      });
      const safeUpdatedUser = privateUserDto(updatedUser);
      socket.emit("profile:updated", safeUpdatedUser);
      const onlineData = onlineUsers.get(userId);
      if (onlineData) {
        onlineUsers.set(userId, { ...publicUserDto({ ...onlineData, ...updatedUser }), socketId: onlineData.socketId });
        io.emit("users:online", publicUsersDto(Array.from(onlineUsers.values())));
      }
    } catch (err) {
      console.error("[DB_ERR] Wallet grant failed:", err);
    }
  });
  socket.on("market:get-items", async () => {
    try {
      const items = await db.avatarItem.findMany();
      socket.emit("market:items", items);
    } catch (err) {
      console.error("[DB_ERR] Fetch market items failed:", err);
    }
  });
  socket.on("market:buy-avatar", async (payload) => {
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      const avatar = await db.avatarItem.findUnique({ where: { id: payload.avatarId } });
      if (!user || !avatar) {
        socket.emit("error", { message: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0438\u043B\u0438 \u0442\u043E\u0432\u0430\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B" });
        return;
      }
      if (user.balance < avatar.price) {
        socket.emit("error", { message: "\u041B\u043E\u043F\u0430\u0442\u0430 \u043F\u0443\u0441\u0442\u0430: \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432" });
        return;
      }
      const ownedAvatars = JSON.parse(user.ownedAvatars || "[]");
      if (ownedAvatars.includes(avatar.imageUrl)) {
        socket.emit("error", { message: "\u0412\u044B \u0443\u0436\u0435 \u0434\u043E\u043C\u0438\u043D\u0438\u0440\u0443\u0435\u0442\u0435 \u0441 \u044D\u0442\u0438\u043C \u0430\u0432\u0430\u0442\u0430\u0440\u043E\u043C" });
        return;
      }
      ownedAvatars.push(avatar.imageUrl);
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: avatar.price },
          ownedAvatars: JSON.stringify(ownedAvatars)
        }
      });
      const safeUpdatedUser = privateUserDto(updatedUser);
      socket.emit("profile:updated", safeUpdatedUser);
      const onlineData = onlineUsers.get(userId);
      if (onlineData) {
        onlineUsers.set(userId, { ...publicUserDto({ ...onlineData, ...updatedUser }), socketId: onlineData.socketId });
        io.emit("users:online", publicUsersDto(Array.from(onlineUsers.values())));
      }
    } catch (err) {
      console.error("[DB_ERR] Buy avatar failed:", err);
    }
  });
};

// src/server/stories/story.repository.ts
init_db();

// src/server/stories/storyPrivacy.ts
var STORY_PRIVACY_VALUES = ["PUBLIC", "CONTACTS", "CLOSE_FRIENDS", "CUSTOM"];
var STORY_MEDIA_TYPES = ["image", "video"];
function isStoryPrivacy(value) {
  return typeof value === "string" && STORY_PRIVACY_VALUES.includes(value);
}
function isStoryMediaType(value) {
  return typeof value === "string" && STORY_MEDIA_TYPES.includes(value);
}
function parseAllowedUsers(allowedUsers) {
  if (!allowedUsers) return [];
  try {
    const parsed = JSON.parse(allowedUsers);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
function validateStoryCreatePayload(payload) {
  if (!payload.mediaUrl || !payload.mediaType) {
    return { error: "Media URL and type are required" };
  }
  if (!isStoryMediaType(payload.mediaType)) {
    return { error: "Invalid media type" };
  }
  if (payload.privacy && !isStoryPrivacy(payload.privacy)) {
    return { error: "Invalid story privacy" };
  }
  const privacy = isStoryPrivacy(payload.privacy) ? payload.privacy : "PUBLIC";
  if (privacy === "CUSTOM" && (!Array.isArray(payload.allowedUsers) || payload.allowedUsers.length === 0)) {
    return { error: "Custom stories require allowedUsers" };
  }
  return { privacy };
}
async function canViewStoryByPrivacy(story, userId, checks) {
  if (!story) return false;
  if (story.userId === userId) return true;
  const privacy = story.privacy || "PUBLIC";
  if (privacy === "PUBLIC") return true;
  if (privacy === "CUSTOM") return parseAllowedUsers(story.allowedUsers).includes(userId);
  if (privacy === "CONTACTS") return Boolean(await checks.hasDirectThread(story.userId, userId));
  if (privacy === "CLOSE_FRIENDS") return Boolean(await checks.isCloseFriend(story.userId, userId));
  return false;
}

// src/server/stories/story.repository.ts
async function hasDirectThread(ownerId, userId) {
  if (ownerId === userId) return true;
  const count = await getPrisma().message.count({
    where: {
      OR: [
        { fromId: ownerId, toUserId: userId },
        { fromId: userId, toUserId: ownerId }
      ]
    }
  });
  return count > 0;
}
async function isCloseFriend(ownerId, userId) {
  if (ownerId === userId) return true;
  const count = await getPrisma().closeFriend.count({
    where: { ownerId, friendId: userId }
  });
  return count > 0;
}
async function canUserViewStory(story, userId) {
  return canViewStoryByPrivacy(story, userId, { hasDirectThread, isCloseFriend });
}
function safeStory(story) {
  if (!story) return story;
  return {
    ...story,
    user: story.user ? safeUser(story.user) : story.user,
    views: Array.isArray(story.views) ? story.views.map((view) => ({ ...view, user: view.user ? safeUser(view.user) : view.user })) : story.views,
    reactions: Array.isArray(story.reactions) ? story.reactions.map((reaction) => ({ ...reaction, user: reaction.user ? safeUser(reaction.user) : reaction.user })) : story.reactions
  };
}
var storyRepository = {
  create: async (data) => {
    return await getPrisma().story.create({ data });
  },
  findById: async (id, requesterUserId) => {
    const story = await getPrisma().story.findUnique({
      where: { id },
      include: {
        user: true,
        views: requesterUserId ? { where: { userId: requesterUserId } } : false
      }
    });
    return safeStory(story);
  },
  findActiveForUser: async (userId) => {
    const now = /* @__PURE__ */ new Date();
    const stories = await getPrisma().story.findMany({
      where: {
        expiresAt: { gt: now },
        isArchived: false
      },
      include: {
        user: true,
        views: {
          where: { userId }
          // fetch views of this user to know if seen
        },
        reactions: true
      },
      orderBy: { createdAt: "asc" }
    });
    const visible = await Promise.all(stories.map(async (story) => await canUserViewStory(story, userId) ? safeStory(story) : null));
    return visible.filter(Boolean);
  },
  findUserArchive: async (userId) => {
    const stories = await getPrisma().story.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: { lte: /* @__PURE__ */ new Date() } },
          { isArchived: true },
          { isHighlight: true }
        ]
      },
      orderBy: { createdAt: "desc" },
      include: {
        views: true,
        reactions: true
      }
    });
    return stories.map(safeStory);
  },
  findUserHighlights: async (targetUserId, requesterUserId) => {
    const stories = await getPrisma().story.findMany({
      where: {
        userId: targetUserId,
        isHighlight: true,
        OR: [
          { privacy: "PUBLIC" },
          { userId: requesterUserId },
          { allowedUsers: { not: null } }
        ]
      },
      orderBy: { createdAt: "asc" }
    });
    const visible = await Promise.all(stories.map(async (story) => await canUserViewStory(story, requesterUserId) ? safeStory(story) : null));
    return visible.filter(Boolean);
  },
  canUserView: canUserViewStory,
  markAsViewed: async (storyId, userId) => {
    try {
      await getPrisma().storyView.create({
        data: {
          storyId,
          userId
        }
      });
      return true;
    } catch {
      return false;
    }
  },
  addReaction: async (storyId, userId, emoji) => {
    try {
      const res = await getPrisma().storyReaction.create({
        data: {
          storyId,
          userId,
          emoji
        }
      });
      return res;
    } catch {
      return null;
    }
  },
  deleteStory: async (id, userId) => {
    const result = await getPrisma().story.deleteMany({
      where: { id, userId }
    });
    return result.count > 0;
  },
  getStoryViews: async (storyId, authorId) => {
    const story = await getPrisma().story.findFirst({
      where: { id: storyId, userId: authorId }
    });
    if (!story) return null;
    const views = await getPrisma().storyView.findMany({
      where: { storyId },
      include: { user: true },
      orderBy: { viewedAt: "desc" }
    });
    return views.map((view) => ({ ...view, user: safeUser(view.user) }));
  }
};

// src/server/socket/story.handler.ts
var notifyStoryCreated = async (io, story, onlineUsers) => {
  await Promise.all(Array.from(onlineUsers.entries()).map(async ([targetUserId, onlineUser]) => {
    if (targetUserId === story.userId) return;
    if (!await storyRepository.canUserView(story, targetUserId)) return;
    const targetSocketId = onlineUser?.socketId;
    if (targetSocketId) io.to(targetSocketId).emit("story:new");
  }));
};
var handleStories = (io, socket, onlineUsers) => {
  socket.on("story:created", async (story) => {
    try {
      if (!story?.id) return;
      const dbStory = await storyRepository.findById(story.id);
      if (!dbStory || dbStory.userId !== socket.userId) return;
      await notifyStoryCreated(io, dbStory, onlineUsers);
    } catch (err) {
      console.error("[STORY_SOCKET_ERR] story:created failed:", err);
    }
  });
  socket.on("story:viewed", async ({ storyId }) => {
    try {
      if (!storyId) return;
      const story = await storyRepository.findById(storyId);
      if (!await storyRepository.canUserView(story, socket.userId)) return;
      const targetSocketId = onlineUsers.get(story.userId)?.socketId;
      if (targetSocketId) {
        io.to(targetSocketId).emit("story:viewUpdate", { storyId, viewerId: socket.userId });
      }
    } catch (err) {
      console.error("[STORY_SOCKET_ERR] story:viewed failed:", err);
    }
  });
  socket.on("story:react", async (data) => {
    try {
      if (!data?.storyId) return;
      const story = await storyRepository.findById(data.storyId);
      if (!await storyRepository.canUserView(story, socket.userId)) return;
      const targetSocketId = onlineUsers.get(story.userId)?.socketId;
      if (targetSocketId) {
        io.to(targetSocketId).emit("story:reactionAdded", {
          storyId: data.storyId,
          reaction: data.reaction,
          viewerId: socket.userId
        });
      }
    } catch (err) {
      console.error("[STORY_SOCKET_ERR] story:react failed:", err);
    }
  });
};

// src/server/repositories/channel.repository.ts
init_db();
var channelRepository = {
  findById: async (id, includeMembers = false) => db.channel.findUnique({
    where: { id },
    include: includeMembers ? { members: { include: { user: true } } } : void 0
  }),
  count: async () => db.channel.count(),
  findMany: async (args = {}) => db.channel.findMany(args),
  findForUser: async (userId) => db.channel.findMany({
    where: { members: { some: { userId } } },
    include: { members: { include: { user: true } } }
  }),
  create: async (data, includeMembers = false) => db.channel.create({
    data,
    include: includeMembers ? { members: { include: { user: true } } } : void 0
  }),
  update: async (id, data, includeMembers = false) => db.channel.update({
    where: { id },
    data,
    include: includeMembers ? { members: { include: { user: true } } } : void 0
  }),
  addMember: async (channelId, userId) => db.channelMember.upsert({
    where: { userId_channelId: { userId, channelId } },
    update: {},
    create: { userId, channelId, role: "subscriber" }
  }),
  deleteWithRelations: async (id) => {
    return db.$transaction([
      db.channelMember.deleteMany({ where: { channelId: id } }),
      db.channelPost.deleteMany({ where: { channelId: id } }),
      db.channel.delete({ where: { id } })
    ]);
  }
};

// src/server/socket/channel.handler.ts
var safeChannelMember = (member) => ({ ...member, user: member.user ? safeUser(member.user) : member.user });
var safeChannelPayload = (channel) => ({
  ...channel,
  owner: channel.owner ? safeUser(channel.owner) : channel.owner,
  members: Array.isArray(channel.members) ? channel.members.map(safeChannelMember) : channel.members
});
var safeChannelPostPayload = (post) => ({
  ...post,
  author: post.author ? safeUser(post.author) : post.author
});
var handleChannels = (io, socket, onlineUsers) => {
  const userId = socket.userId;
  const getChannelAccess = async (channelId) => {
    const channel = await channelRepository.findById(channelId, true);
    if (!channel) return { channel: null, member: null, canView: false, canManage: false };
    const member = channel.members.find((m) => m.userId === userId);
    return {
      channel,
      member,
      canView: Boolean(member) || channel.isPublic === true,
      canManage: member?.role === "owner" || member?.role === "admin" || channel.ownerId === userId
    };
  };
  socket.on("channel:create", async (payload) => {
    try {
      const { name, description, isPublic } = createChannelSchema.parse(payload);
      const generatedAvatar = generateGroupAvatar(name);
      const newChannel = await channelRepository.create({
        name,
        description,
        isPublic: isPublic || false,
        ownerId: userId,
        avatarColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
        avatarImage: generatedAvatar,
        initials: name.substring(0, 2).toUpperCase(),
        members: {
          create: [
            { userId, role: "owner" }
          ]
        }
      }, true);
      const userSocket = onlineUsers.get(userId)?.socketId;
      if (userSocket) {
        io.to(userSocket).emit("channel:new", { ...safeChannelPayload(newChannel), isChannel: true });
      }
    } catch (err) {
      console.error("[DB_ERR] Channel creation failed:", err);
    }
  });
  socket.on("channel:update", async (payload) => {
    try {
      const { id, name, avatarImage } = updateChannelSchema.parse(payload);
      const access = await getChannelAccess(id);
      if (!access.canManage) {
        socket.emit("error", { message: "Access denied" });
        return;
      }
      const updatedChannel = await channelRepository.update(id, {
        name,
        avatarImage,
        initials: name ? name.substring(0, 2).toUpperCase() : void 0
      }, true);
      updatedChannel.members.forEach((m) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit("channel:updated", { ...safeChannelPayload(updatedChannel), isChannel: true });
      });
    } catch (err) {
      console.error("[DB_ERR] Channel update failed:", err);
    }
  });
  socket.on("channel:add-member", async (payload) => {
    try {
      const { channelId, userId: targetUserId } = payload;
      if (typeof channelId !== "string" || typeof targetUserId !== "string") return;
      const access = await getChannelAccess(channelId);
      if (!access.canManage) {
        socket.emit("error", { message: "Access denied" });
        return;
      }
      await channelRepository.addMember(channelId, targetUserId);
      const updatedChannel = await channelRepository.findById(channelId, true);
      if (updatedChannel) {
        updatedChannel.members.forEach((m) => {
          const mSocket = onlineUsers.get(m.userId)?.socketId;
          if (mSocket) io.to(mSocket).emit("channel:updated", { ...safeChannelPayload(updatedChannel), isChannel: true });
        });
      }
    } catch (err) {
      console.error("[DB_ERR] Add channel member failed:", err);
    }
  });
  socket.on("channel:history", async (payload) => {
    try {
      const { channelId } = payload;
      if (typeof channelId !== "string") return;
      const access = await getChannelAccess(channelId);
      if (!access.canView) {
        socket.emit("error", { message: "Access denied" });
        return;
      }
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const posts = await db2.channelPost.findMany({
        where: { channelId },
        include: { author: true, reactions: true },
        orderBy: { createdAt: "desc" },
        take: 50
      });
      socket.emit("channel:history:result", { channelId, posts: posts.reverse().map(safeChannelPostPayload) });
    } catch (err) {
      console.error("[DB_ERR] Channel history fetch failed:", err);
    }
  });
  socket.on("channel:post:create", async (payload) => {
    try {
      const { channelId, content, attachments } = payload;
      if (typeof channelId !== "string") return;
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const access = await getChannelAccess(channelId);
      const channel = access.channel;
      if (!channel) return;
      if (!access.canManage) {
        return;
      }
      const post = await db2.channelPost.create({
        data: {
          channelId,
          authorId: userId,
          content,
          attachments: typeof attachments === "string" ? attachments : attachments ? JSON.stringify(attachments) : null
        },
        include: { author: true, reactions: true }
      });
      channel.members.forEach((m) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit("channel:post:new", { channelId, post: safeChannelPostPayload(post) });
      });
    } catch (err) {
      console.error("[DB_ERR] Channel post creation failed:", err);
    }
  });
  socket.on("channel:post:react", async (payload) => {
    try {
      const { postId, emoji } = payload;
      if (typeof postId !== "string" || typeof emoji !== "string") return;
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const targetPost = await db2.channelPost.findUnique({ where: { id: postId } });
      if (!targetPost) return;
      const access = await getChannelAccess(targetPost.channelId);
      if (!access.member) {
        socket.emit("error", { message: "Access denied" });
        return;
      }
      const existing = await db2.channelReaction.findFirst({
        where: {
          userId,
          postId,
          emoji
        }
      });
      if (existing) {
        await db2.channelReaction.delete({
          where: { id: existing.id }
        });
      } else {
        await db2.channelReaction.create({
          data: {
            userId,
            postId,
            emoji
          }
        });
      }
      const updatedPost = await db2.channelPost.findUnique({
        where: { id: postId },
        include: { author: true, reactions: true }
      });
      if (updatedPost) {
        const channel = await channelRepository.findById(updatedPost.channelId, true);
        if (channel) {
          channel.members.forEach((m) => {
            const mSocket = onlineUsers.get(m.userId)?.socketId;
            if (mSocket) io.to(mSocket).emit("channel:post:updated", { channelId: updatedPost.channelId, post: safeChannelPostPayload(updatedPost) });
          });
        }
      }
    } catch (err) {
      console.error("[DB_ERR] Channel post reaction failed:", err);
    }
  });
  socket.on("channel:post:view", async (payload) => {
    try {
      const { postId } = payload;
      if (typeof postId !== "string") return;
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const targetPost = await db2.channelPost.findUnique({ where: { id: postId } });
      if (!targetPost) return;
      const access = await getChannelAccess(targetPost.channelId);
      if (!access.canView) {
        socket.emit("error", { message: "Access denied" });
        return;
      }
      const updatedPost = await db2.channelPost.update({
        where: { id: postId },
        data: { views: { increment: 1 } },
        include: { author: true, reactions: true }
      });
      const channel = await channelRepository.findById(updatedPost.channelId, true);
      if (channel) {
        channel.members.forEach((m) => {
          const mSocket = onlineUsers.get(m.userId)?.socketId;
          if (mSocket) io.to(mSocket).emit("channel:post:updated", { channelId: updatedPost.channelId, post: safeChannelPostPayload(updatedPost) });
        });
      }
    } catch (err) {
      console.error("[DB_ERR] Channel post view increment failed:", err);
    }
  });
  socket.on("channel:delete", async (payload) => {
    try {
      const { channelId } = payload;
      if (typeof channelId !== "string") return;
      const access = await getChannelAccess(channelId);
      if (!access.canManage || !access.channel) {
        socket.emit("error", { message: "Access denied" });
        return;
      }
      const members = access.channel.members || [];
      await channelRepository.deleteWithRelations(channelId);
      members.forEach((m) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit("channel:deleted", { channelId });
      });
    } catch (err) {
      console.error("[DB_ERR] Channel delete failed:", err);
    }
  });
};

// src/server/socket/index.ts
var import_jsonwebtoken4 = __toESM(require("jsonwebtoken"), 1);
var setupSocketHandlers = (io) => {
  const onlineUsers = /* @__PURE__ */ new Map();
  const socketToUserMap = /* @__PURE__ */ new Map();
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));
    try {
      import_jsonwebtoken4.default.verify(token, getJwtSecret(), (err, decoded) => {
        if (err || !decoded || typeof decoded !== "object" || !decoded.userId) {
          return next(new Error("Authentication error"));
        }
        socket.userId = decoded.userId;
        next();
      });
    } catch {
      next(new Error("Authentication error"));
    }
  });
  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(`[AUTH] User connected: ${userId} (Socket: ${socket.id})`);
    handleUsers(io, socket, onlineUsers, socketToUserMap);
    handleWallet(io, socket, onlineUsers);
    handleMessages(io, socket, onlineUsers);
    handleGroups(io, socket, onlineUsers);
    handleChannels(io, socket, onlineUsers);
    handleCalls(io, socket, onlineUsers);
    handleStories(io, socket, onlineUsers);
  });
};

// src/server/stories/story.controller.ts
var storyController = {
  // Create a new story
  createStory: async (req, res) => {
    try {
      const { mediaUrl, mediaType, caption, privacy, expiresInHours, allowedUsers } = req.body;
      const userId = req.userId;
      const validation = validateStoryCreatePayload({ mediaUrl, mediaType, privacy, allowedUsers });
      if ("error" in validation) return res.status(400).json({ error: validation.error });
      const normalizedPrivacy = validation.privacy;
      const expiresAt = /* @__PURE__ */ new Date();
      expiresAt.setHours(expiresAt.getHours() + (expiresInHours || 24));
      const newStory = await storyRepository.create({
        userId,
        mediaUrl,
        mediaType,
        caption,
        privacy: normalizedPrivacy,
        expiresAt,
        allowedUsers: normalizedPrivacy === "CUSTOM" ? JSON.stringify(allowedUsers) : null
      });
      const populated = await storyRepository.findById(newStory.id);
      return res.status(201).json(populated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create story" });
    }
  },
  // Get active stories for feed
  getActiveStories: async (req, res) => {
    try {
      const userId = req.userId;
      const stories = await storyRepository.findActiveForUser(userId);
      res.json(stories);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch stories" });
    }
  },
  // View a story
  viewStory: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const story = await storyRepository.findById(id);
      if (!await storyRepository.canUserView(story, userId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const viewed = await storyRepository.markAsViewed(id, userId);
      res.json({ success: true, newView: viewed });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to view story" });
    }
  },
  // React to a story
  reactToStory: async (req, res) => {
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      const userId = req.userId;
      const story = await storyRepository.findById(id);
      if (!await storyRepository.canUserView(story, userId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const reaction = await storyRepository.addReaction(id, userId, emoji);
      res.json({ success: true, reaction });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to react to story" });
    }
  },
  // Get archive
  getArchive: async (req, res) => {
    try {
      const userId = req.userId;
      const archive = await storyRepository.findUserArchive(userId);
      res.json(archive);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch archive" });
    }
  },
  // Delete story
  deleteStory: async (req, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      await storyRepository.deleteStory(id, userId);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to delete story" });
    }
  },
  // Get views
  getViews: async (req, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const views = await storyRepository.getStoryViews(id, userId);
      if (!views) return res.status(403).json({ error: "Access denied" });
      res.json(views);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch views" });
    }
  }
};

// src/server/utils/fileValidation.ts
var import_fs = __toESM(require("fs"), 1);
var allowedUploadMimes = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/webm",
  "video/mp4",
  "video/quicktime",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "application/pdf"
]);
function extensionFromMime(mime) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/webm": ".webm",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "application/pdf": ".pdf"
  };
  if (!mime) return "";
  return map[mime.split(";")[0].toLowerCase()] || "";
}
function hasExpectedFileSignature(filePath, mimeType) {
  const mime = mimeType.split(";")[0].toLowerCase();
  const buffer = import_fs.default.readFileSync(filePath);
  if (buffer.length < 4) return false;
  if (mime === "image/jpeg") return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/gif") return buffer.subarray(0, 3).toString("ascii") === "GIF";
  if (mime === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (mime === "video/webm" || mime === "audio/webm") return buffer.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  if (mime === "video/mp4" || mime === "video/quicktime" || mime === "audio/mp4" || mime === "audio/x-m4a") return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  if (mime === "audio/ogg") return buffer.subarray(0, 4).toString("ascii") === "OggS";
  if (mime === "audio/mpeg") return buffer.subarray(0, 3).toString("ascii") === "ID3" || buffer[0] === 255 && (buffer[1] & 224) === 224;
  if (mime === "application/pdf") return buffer.subarray(0, 4).toString("ascii") === "%PDF";
  return false;
}
function isAllowedUploadMime(mime) {
  const normalized = (mime || "").split(";")[0].toLowerCase();
  return allowedUploadMimes.has(normalized) && Boolean(extensionFromMime(normalized));
}

// server.ts
var normalizePhone3 = (phone) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) return `7${digits.slice(1)}`;
  return digits;
};
async function startServer() {
  const app = (0, import_express.default)();
  const logger = (0, import_pino.default)({ level: process.env.LOG_LEVEL || "info" });
  app.use((0, import_pino_http.default)({ logger }));
  try {
    const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    logger.info("Performing database health check...");
    await db2.user.count();
    logger.info("Database health check passed.");
  } catch (error) {
    logger.error({ error }, "Database health check failed! Attempting self-healing...");
    const errorStr = String(error.message || error);
    if (errorStr.includes("malformed") || errorStr.includes("disk image") || errorStr.includes("SqliteError") || errorStr.includes("ConnectorError")) {
      try {
        if (process.env.NODE_ENV === "production") {
          logger.error("Database self-healing is disabled in production to prevent accidental data loss.");
          process.exit(1);
        }
        const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        try {
          await db2.$disconnect();
        } catch (disconnErr) {
        }
        const dbPath = import_path.default.join(process.cwd(), "prisma", "dev.db");
        logger.warn(`Removing malformed/corrupted SQLite database file: ${dbPath}`);
        if (import_fs2.default.existsSync(dbPath)) {
          import_fs2.default.unlinkSync(dbPath);
        }
        logger.info("Recreating database schema with npx prisma db push...");
        (0, import_child_process.execSync)("npx prisma db push --accept-data-loss", { stdio: "inherit" });
        logger.info("Database self-healing successful!");
      } catch (healingError) {
        logger.error({ healingError }, "Failed to self-heal the database.");
      }
    }
  }
  const collectDefaultMetrics = import_prom_client.default.collectDefaultMetrics;
  collectDefaultMetrics({ register: import_prom_client.default.register });
  app.get("/metrics", async (req, res) => {
    const metricsToken = process.env.METRICS_TOKEN;
    if (process.env.NODE_ENV === "production") {
      const auth = req.headers.authorization || "";
      if (!metricsToken || auth !== `Bearer ${metricsToken}`) {
        return res.status(404).end();
      }
    }
    res.set("Content-Type", import_prom_client.default.register.contentType);
    res.end(await import_prom_client.default.register.metrics());
  });
  app.use(import_express.default.json());
  const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean);
  const allowAnyOrigin = process.env.NODE_ENV !== "production" && allowedOrigins.length === 0;
  const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (allowAnyOrigin) return true;
    return allowedOrigins.includes(origin);
  };
  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (allowAnyOrigin) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (requestOrigin && isAllowedOrigin(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });
  const httpServer = (0, import_http.createServer)(app);
  const io = new import_socket.Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Socket origin not allowed"));
      },
      credentials: true
    },
    maxHttpBufferSize: 1e8
  });
  if (process.env.REDIS_URL) {
    logger.info("Setting up Redis Adapter for Socket.io");
    try {
      const pubClient = new import_ioredis.Redis(process.env.REDIS_URL);
      const subClient = pubClient.duplicate();
      pubClient.on("error", (err) => {
        logger.error(err, "Redis pubClient error");
      });
      subClient.on("error", (err) => {
        logger.error(err, "Redis subClient error");
      });
      io.adapter((0, import_redis_adapter.createAdapter)(pubClient, subClient));
    } catch (e) {
      logger.error(e, "Failed to setup Redis adapter");
    }
  } else {
    logger.info("Running in in-memory socket mode (no REDIS_URL provided)");
  }
  const PORT = Number(process.env.PORT) || 3e3;
  const uploadDir = import_path.default.join(process.cwd(), "uploads");
  if (!import_fs2.default.existsSync(uploadDir)) {
    import_fs2.default.mkdirSync(uploadDir);
  }
  const storage = import_multer.default.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + extensionFromMime(file.mimetype));
    }
  });
  const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 50;
  const upload = (0, import_multer.default)({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      cb(null, isAllowedUploadMime(file.mimetype));
    }
  });
  app.use("/uploads", import_express.default.static(uploadDir, {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'none'; script-src 'none'; sandbox");
    }
  }));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "nexa-messenger" });
  });
  app.post("/api/upload", authenticateUser, (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` });
        }
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      if (!hasExpectedFileSignature(req.file.path, req.file.mimetype)) {
        import_fs2.default.unlink(req.file.path, () => {
        });
        return res.status(400).json({ error: "File content does not match its declared type" });
      }
      const url = `/uploads/${req.file.filename}`;
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const file = await db2.uploadedFile.create({
        data: {
          userId: req.userId,
          fileName: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url
        }
      });
      res.json({ fileId: file.id, url, type: req.file.mimetype, name: req.file.originalname });
    } catch (err) {
      if (req.file?.path) import_fs2.default.unlink(req.file.path, () => {
      });
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  });
  const authRateLimit = (0, import_express_rate_limit.default)({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1e3,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
    message: { error: "Too many attempts" },
    standardHeaders: true,
    legacyHeaders: false
  });
  const aiRateLimit = (0, import_express_rate_limit.default)({
    windowMs: Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60 * 1e3,
    max: Number(process.env.AI_RATE_LIMIT_MAX) || 12,
    message: { error: "Too many AI requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.post("/api/auth/register", authRateLimit, authController.register);
  app.post("/api/auth/login", authRateLimit, authController.login);
  app.get("/api/users", authenticateUser, async (req, res) => {
    try {
      const { userRepository: userRepository2 } = await Promise.resolve().then(() => (init_user_repository(), user_repository_exports));
      const users = await userRepository2.findMany();
      const safeUsers = users.map(safeUser);
      res.json(safeUsers);
    } catch (err) {
      console.error("[API Error] Failed to fetch users:", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  app.post("/api/contacts/match", authenticateUser, async (req, res) => {
    try {
      const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts.slice(0, 1e3) : [];
      const normalizedByPhone = /* @__PURE__ */ new Map();
      const preparedContacts = contacts.map((contact, index) => {
        const phones = Array.isArray(contact?.phones) ? contact.phones.map((phone) => String(phone || "")) : [];
        const normalizedPhones2 = phones.map((phone) => normalizePhone3(String(phone || ""))).filter(Boolean);
        normalizedPhones2.forEach((phone) => normalizedByPhone.set(phone, String(phones[0] || phone)));
        return {
          id: String(contact?.id || `phone-contact-${index}`),
          name: String(contact?.name || phones[0] || "Contact"),
          phones,
          normalizedPhones: normalizedPhones2
        };
      });
      const normalizedPhones = Array.from(new Set(preparedContacts.flatMap((contact) => contact.normalizedPhones)));
      const matchedUsers = normalizedPhones.length ? await (await Promise.resolve().then(() => (init_db(), db_exports))).db.user.findMany({
        where: {
          normalizedPhone: { in: normalizedPhones },
          id: { not: req.userId }
        }
      }) : [];
      const userByPhone = /* @__PURE__ */ new Map();
      matchedUsers.forEach((matchedUser) => {
        if (matchedUser.normalizedPhone) userByPhone.set(matchedUser.normalizedPhone, safeUser(matchedUser));
      });
      res.json({
        contacts: preparedContacts.map((contact) => {
          const matchedPhone = contact.normalizedPhones.find((phone) => userByPhone.has(phone));
          return {
            id: contact.id,
            name: contact.name,
            phones: contact.phones,
            matchedPhone: matchedPhone ? normalizedByPhone.get(matchedPhone) : null,
            user: matchedPhone ? userByPhone.get(matchedPhone) : null
          };
        })
      });
    } catch (err) {
      console.error("[API Error] Failed to match phone contacts:", err);
      res.status(500).json({ error: "Failed to match phone contacts" });
    }
  });
  app.post("/api/ai/chat", authenticateUser, aiRateLimit, async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(503).json({ error: "Gemini API key is not configured" });
      }
      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (prompt.length < 2) return res.status(400).json({ error: "Prompt is required" });
      if (prompt.length > 4e3) return res.status(400).json({ error: "Prompt is too long" });
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt
      });
      res.json({ text: response.text || "" });
    } catch (err) {
      console.error("[AI Error] Gemini request failed:", err);
      res.status(500).json({ error: "AI request failed" });
    }
  });
  app.post("/api/push/register", authenticateUser, pushController.registerToken);
  app.post("/api/push/unregister", authenticateUser, pushController.unregisterToken);
  app.post("/api/stories", authenticateUser, storyController.createStory);
  app.get("/api/stories/active", authenticateUser, storyController.getActiveStories);
  app.get("/api/stories/archive", authenticateUser, storyController.getArchive);
  app.post("/api/stories/:id/view", authenticateUser, storyController.viewStory);
  app.post("/api/stories/:id/react", authenticateUser, storyController.reactToStory);
  app.get("/api/stories/:id/views", authenticateUser, storyController.getViews);
  app.delete("/api/stories/:id", authenticateUser, storyController.deleteStory);
  app.get("/api/admin/stats", authenticateAdmin, adminController.getStats);
  app.get("/api/admin/users", authenticateAdmin, adminController.getUsers);
  app.post("/api/admin/users/:id/role", authenticateAdmin, adminController.updateUserRole);
  app.delete("/api/admin/users/:id", authenticateAdmin, adminController.deleteUser);
  app.get("/api/admin/groups", authenticateAdmin, adminController.getGroups);
  app.delete("/api/admin/groups/:id", authenticateAdmin, adminController.deleteGroup);
  app.get("/api/admin/messages", authenticateAdmin, adminController.getMessages);
  app.delete("/api/admin/messages/:id", authenticateAdmin, adminController.deleteMessage);
  setupSocketHandlers(io);
  app.use((err, req, res, next) => {
    console.error("[API Error]", err);
    if (req.path.startsWith("/api/")) {
      return res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
    }
    next(err);
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`========================================`);
    console.log(`      NEXA MESSENGER auth-READY       `);
    console.log(`========================================`);
    console.log(`Server: Running at http://0.0.0.0:${PORT}`);
    console.log(`Time:   ${(/* @__PURE__ */ new Date()).toISOString()}`);
    console.log(`Mode:   ${process.env.NODE_ENV || "development"}`);
    console.log(`========================================`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
