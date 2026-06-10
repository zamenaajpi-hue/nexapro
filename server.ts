import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import pino from 'pino';
import pinoHttp from 'pino-http';
import client from 'prom-client';
import rateLimit from 'express-rate-limit';
import { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { execSync } from 'child_process';

import { authController } from './src/server/controllers/auth.controller';
import { adminController } from './src/server/controllers/admin.controller';
import { pushController } from './src/server/controllers/push.controller';
import { authenticateAdmin } from './src/server/middlewares/admin.middleware';
import { authenticateUser } from './src/server/middlewares/auth.middleware';
import { setupSocketHandlers } from './src/server/socket';
import { storyController } from './src/server/stories/story.controller';
import { safeUser } from './src/server/utils/safeUser';
import { extensionFromMime, hasExpectedFileSignature, isAllowedUploadMime } from './src/server/utils/fileValidation';

const normalizePhone = (phone?: string | null) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) return `7${digits.slice(1)}`;
  return digits;
};

async function startServer() {
  const app = express();
  
  // Setup Logger
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  app.use(pinoHttp({ logger }));

  // --- Database Sanity Check & Self-Healing ---
  try {
    const { db } = await import('./src/services/db');
    logger.info('Performing database health check...');
    await db.user.count();
    logger.info('Database health check passed.');
  } catch (error: any) {
    logger.error({ error }, 'Database health check failed! Attempting self-healing...');
    const errorStr = String(error.message || error);
    if (
      errorStr.includes('malformed') || 
      errorStr.includes('disk image') || 
      errorStr.includes('SqliteError') || 
      errorStr.includes('ConnectorError')
    ) {
      try {
        if (process.env.NODE_ENV === 'production') {
          logger.error('Database self-healing is disabled in production to prevent accidental data loss.');
          process.exit(1);
        }
        const { db } = await import('./src/services/db');
        // Попытка закрыть соединение Prisma, чтобы освободить блокировку SQLite-файла перед удалением
        try {
          await db.$disconnect();
        } catch (disconnErr) {
          // Игнорируем ошибку отключения
        }

        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        logger.warn(`Removing malformed/corrupted SQLite database file: ${dbPath}`);
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
        }
        
        logger.info('Recreating database schema with npx prisma db push...');
        execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
        logger.info('Database self-healing successful!');
      } catch (healingError) {
        logger.error({ healingError }, 'Failed to self-heal the database.');
      }
    }
  }

  // Setup Metrics
  const collectDefaultMetrics = client.collectDefaultMetrics;
  collectDefaultMetrics({ register: client.register });

  app.get('/metrics', async (req, res) => {
    const metricsToken = process.env.METRICS_TOKEN;
    if (process.env.NODE_ENV === 'production') {
      const auth = req.headers.authorization || '';
      if (!metricsToken || auth !== `Bearer ${metricsToken}`) {
        return res.status(404).end();
      }
    }
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });

  app.use(express.json());

  // --- CORS Middleware for API routes ---
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  const allowAnyOrigin = process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0;
  const isAllowedOrigin = (origin?: string) => {
    if (!origin) return true;
    if (allowAnyOrigin) return true;
    return allowedOrigins.includes(origin);
  };

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (allowAnyOrigin) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (requestOrigin && isAllowedOrigin(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Socket origin not allowed'));
      },
      credentials: true,
    },
    maxHttpBufferSize: 1e8,
  });

  if (process.env.REDIS_URL) {
    logger.info('Setting up Redis Adapter for Socket.io');
    try {
      const pubClient = new Redis(process.env.REDIS_URL);
      const subClient = pubClient.duplicate();
      
      pubClient.on('error', (err) => {
        logger.error(err, 'Redis pubClient error');
      });
      subClient.on('error', (err) => {
        logger.error(err, 'Redis subClient error');
      });

      io.adapter(createAdapter(pubClient, subClient));
    } catch(e) {
      logger.error(e, 'Failed to setup Redis adapter');
    }
  } else {
    logger.info('Running in in-memory socket mode (no REDIS_URL provided)');
  }

  const PORT = Number(process.env.PORT) || 3000;

  // --- Uploading Logic ---
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + extensionFromMime(file.mimetype));
    }
  });

  const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 50;
  const upload = multer({ 
    storage,
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      cb(null, isAllowedUploadMime(file.mimetype));
    }
  });

  app.use('/uploads', express.static(uploadDir, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'none'; script-src 'none'; sandbox");
    }
  }));

  // --- Health Check API ---
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'nexa-messenger' });
  });

  // --- File Upload API ---
  app.post('/api/upload', authenticateUser, (req, res: any, next) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` });
        }
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  }, async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      if (!hasExpectedFileSignature(req.file.path, req.file.mimetype)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'File content does not match its declared type' });
      }
      // TODO: add multipart integration test that asserts UploadedFile is not created when validation fails.
      const url = `/uploads/${req.file.filename}`;
      const { db } = await import('./src/services/db');
      const file = await db.uploadedFile.create({
        data: {
          userId: req.userId,
          fileName: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url,
        },
      });
      res.json({ fileId: file.id, url, type: req.file.mimetype, name: req.file.originalname });
    } catch (err: any) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: err.message || 'Upload failed' });
    }
  });

  // --- Auth Routes ---
  const authRateLimit = rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
    message: { error: 'Too many attempts' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const aiRateLimit = rateLimit({
    windowMs: Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
    max: Number(process.env.AI_RATE_LIMIT_MAX) || 12,
    message: { error: 'Too many AI requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.post('/api/auth/register', authRateLimit, authController.register);
  app.post('/api/auth/login', authRateLimit, authController.login);

  // --- Users Routes ---
  app.get('/api/users', authenticateUser, async (req: any, res) => {
    try {
      const { userRepository } = await import('./src/server/repositories/user.repository');
      const users = await userRepository.findMany();
      const safeUsers = users.map(safeUser);
      res.json(safeUsers);
    } catch (err: any) {
      console.error('[API Error] Failed to fetch users:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/contacts/match', authenticateUser, async (req: any, res) => {
    try {
      const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts.slice(0, 1000) : [];
      const normalizedByPhone = new Map<string, string>();

      const preparedContacts = contacts.map((contact: any, index: number) => {
        const phones = Array.isArray(contact?.phones) ? contact.phones.map((phone: unknown) => String(phone || '')) : [];
        const normalizedPhones = phones
          .map((phone: unknown) => normalizePhone(String(phone || '')))
          .filter(Boolean) as string[];

        normalizedPhones.forEach((phone) => normalizedByPhone.set(phone, String(phones[0] || phone)));

        return {
          id: String(contact?.id || `phone-contact-${index}`),
          name: String(contact?.name || phones[0] || 'Contact'),
          phones,
          normalizedPhones,
        };
      });

      const normalizedPhones: string[] = Array.from(new Set(preparedContacts.flatMap((contact) => contact.normalizedPhones)));
      const matchedUsers = normalizedPhones.length
        ? await (await import('./src/services/db')).db.user.findMany({
            where: {
              normalizedPhone: { in: normalizedPhones },
              id: { not: req.userId },
            },
          })
        : [];

      const userByPhone = new Map<string, any>();
      matchedUsers.forEach((matchedUser: any) => {
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
            user: matchedPhone ? userByPhone.get(matchedPhone) : null,
          };
        }),
      });
    } catch (err: any) {
      console.error('[API Error] Failed to match phone contacts:', err);
      res.status(500).json({ error: 'Failed to match phone contacts' });
    }
  });

  app.post('/api/ai/chat', authenticateUser, aiRateLimit, async (req: any, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(503).json({ error: 'Gemini API key is not configured' });
      }

      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (prompt.length < 2) return res.status(400).json({ error: 'Prompt is required' });
      if (prompt.length > 4000) return res.status(400).json({ error: 'Prompt is too long' });

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response: any = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: prompt,
      });

      res.json({ text: response.text || '' });
    } catch (err: any) {
      console.error('[AI Error] Gemini request failed:', err);
      res.status(500).json({ error: 'AI request failed' });
    }
  });

  // --- Push Notification Token Routes ---
  app.post('/api/push/register', authenticateUser, pushController.registerToken);
  app.post('/api/push/unregister', authenticateUser, pushController.unregisterToken);

  // --- Stories Routes ---
  app.post('/api/stories', authenticateUser, storyController.createStory);
  app.get('/api/stories/active', authenticateUser, storyController.getActiveStories);
  app.get('/api/stories/archive', authenticateUser, storyController.getArchive);
  app.post('/api/stories/:id/view', authenticateUser, storyController.viewStory);
  app.post('/api/stories/:id/react', authenticateUser, storyController.reactToStory);
  app.get('/api/stories/:id/views', authenticateUser, storyController.getViews);
  app.delete('/api/stories/:id', authenticateUser, storyController.deleteStory);

  // --- Admin Routes ---
  app.get('/api/admin/stats', authenticateAdmin, adminController.getStats);
  app.get('/api/admin/users', authenticateAdmin, adminController.getUsers);
  app.post('/api/admin/users/:id/role', authenticateAdmin, adminController.updateUserRole);
  app.delete('/api/admin/users/:id', authenticateAdmin, adminController.deleteUser);
  
  app.get('/api/admin/groups', authenticateAdmin, adminController.getGroups);
  app.delete('/api/admin/groups/:id', authenticateAdmin, adminController.deleteGroup);
  
  app.get('/api/admin/messages', authenticateAdmin, adminController.getMessages);
  app.delete('/api/admin/messages/:id', authenticateAdmin, adminController.deleteMessage);

  // --- Socket Middleware & Handlers ---
  setupSocketHandlers(io);

  // --- Error Handler for API Routes ---
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[API Error]', err);
    if (req.path.startsWith('/api/')) {
      return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    }
    next(err);
  });

  // --- Vite / Frontend Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`      NEXA MESSENGER auth-READY       `);
    console.log(`========================================`);
    console.log(`Server: Running at http://0.0.0.0:${PORT}`);
    console.log(`Time:   ${new Date().toISOString()}`);
    console.log(`Mode:   ${process.env.NODE_ENV || 'development'}`);
    console.log(`========================================`);
  });
}

startServer();
