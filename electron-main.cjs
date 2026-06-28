const { app, BrowserWindow, Menu, Tray, ipcMain, shell, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { dialog } = require('electron');
const { pathToFileURL } = require('url');

let mainWindow;
let tray;
let isQuitting = false;
let localServerProcess = null;
let localServerUrl = null;
let localServerStarted = false;
const DESKTOP_SERVER_PORT = Number(process.env.NEXA_DESKTOP_PORT || 47832);
const MEDIA_PERMISSIONS = new Set(['media', 'microphone', 'camera']);
const mediaPermissionDecisions = new Map();
const DEFAULT_REMOTE_SERVER_URL = process.env.NEXA_DEFAULT_SERVER_URL || 'http://64.188.67.71:3000';

function getDesktopMainLogPath() {
  try {
    return path.join(app.getPath('userData'), 'desktop-main.log');
  } catch {
    return path.join(__dirname, 'desktop-main.log');
  }
}

function logMainEvent(message, error) {
  const details = error ? ` ${error.stack || error}` : '';
  const line = `[${new Date().toISOString()}] ${message}${details}\n`;
  try {
    fs.appendFileSync(getDesktopMainLogPath(), line);
  } catch {
    // Logging must never break desktop startup.
  }
  console.log(line.trim());
}

process.on('uncaughtException', (error) => {
  logMainEvent('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  logMainEvent('Unhandled rejection:', error);
});

// Config file path for persistent settings
function getConfigPath() {
  return path.join(app.getPath('userData'), 'nexa-config.json');
}

// Get saved URL from config file or return default candidate array
function getSavedServerUrl() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data && data.serverUrl) {
        return data.serverUrl;
      }
    }
  } catch (e) {
    console.error('Error reading config:', e);
  }
  return null;
}

function saveServerUrl(url) {
  try {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify({ serverUrl: url }), 'utf8');
  } catch (e) {
    console.error('Error writing config:', e);
  }
}

function isLoopbackServerUrl(urlToCheck) {
  try {
    const { hostname } = new URL(urlToCheck);
    const normalizedHost = hostname.toLowerCase();
    return normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::1';
  } catch {
    return false;
  }
}

function getPackagedDistPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'dist')
    : path.join(__dirname, 'dist');
}

function getPackagedUiUrl(serverUrl) {
  const indexPath = path.join(getPackagedDistPath(), 'index.html');
  const uiUrl = pathToFileURL(indexPath);
  if (serverUrl) {
    uiUrl.searchParams.set('serverUrl', serverUrl);
  }
  return uiUrl;
}

function getPackagedServerPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'dist', 'server.cjs')
    : path.join(__dirname, 'dist', 'server.cjs');
}

function getBundledDbPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'prisma', 'dev.db')
    : path.join(__dirname, 'prisma', 'dev.db');
}

function ensureDesktopDatabase(targetDbPath) {
  try {
    const bundledDbPath = getBundledDbPath();
    const needsSeed = !fs.existsSync(targetDbPath) || fs.statSync(targetDbPath).size < 1024;
    if (needsSeed && fs.existsSync(bundledDbPath)) {
      fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
      fs.copyFileSync(bundledDbPath, targetDbPath);
      console.log('Desktop database initialized:', targetDbPath);
    }
  } catch (error) {
    console.warn('Failed to initialize desktop database:', error);
  }
}

function ensureDesktopJwtSecret(userDataPath) {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 32) {
    return process.env.JWT_SECRET.trim();
  }

  const secretPath = path.join(userDataPath, 'nexa-jwt-secret');
  try {
    if (fs.existsSync(secretPath)) {
      const savedSecret = fs.readFileSync(secretPath, 'utf8').trim();
      if (savedSecret.length >= 32) return savedSecret;
    }

    const nextSecret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretPath, nextSecret, { encoding: 'utf8', mode: 0o600 });
    return nextSecret;
  } catch (error) {
    console.warn('Failed to persist desktop JWT secret, using in-memory fallback:', error);
    return crypto.randomBytes(48).toString('hex');
  }
}

let packagedPrismaResolverInstalled = false;

function installPackagedPrismaResolver(logPath) {
  if (!app.isPackaged || packagedPrismaResolverInstalled) return;

  const prismaClientDir = path.join(process.resourcesPath, 'node_modules', '.prisma', 'client');
  if (!fs.existsSync(prismaClientDir)) {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Prisma client directory missing: ${prismaClientDir}\n`);
    return;
  }

  const queryEnginePath = path.join(prismaClientDir, 'query_engine-windows.dll.node');
  if (fs.existsSync(queryEnginePath)) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = queryEnginePath;
  }

  const Module = require('module');
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function resolvePackagedPrismaClient(request, parent, isMain, options) {
    if (request === '.prisma/client' || request.startsWith('.prisma/client/')) {
      const relativeRequest = request.replace(/^\.prisma[\\/]client[\\/]?/, '') || 'index';
      return originalResolveFilename.call(this, path.join(prismaClientDir, relativeRequest), parent, isMain, options);
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  packagedPrismaResolverInstalled = true;
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] Prisma client resolver installed: ${prismaClientDir}\n`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function getDesktopServerPort() {
  if (await isPortAvailable(DESKTOP_SERVER_PORT)) {
    return DESKTOP_SERVER_PORT;
  }

  const existingUrl = `http://127.0.0.1:${DESKTOP_SERVER_PORT}`;
  if (await testServerConnection(existingUrl)) {
    localServerUrl = existingUrl;
    return DESKTOP_SERVER_PORT;
  }

  return getFreePort();
}

async function startLocalServer() {
  if (localServerUrl) return localServerUrl;

  const serverPath = getPackagedServerPath();
  if (!fs.existsSync(serverPath)) {
    console.warn('Packaged server file was not found:', serverPath);
    return null;
  }

  const userDataPath = app.getPath('userData');
  const port = await getDesktopServerPort();
  if (localServerUrl) return localServerUrl;
  const desktopDbPath = path.join(userDataPath, 'nexa-desktop.db');
  const logPath = path.join(userDataPath, 'desktop-server.log');
  ensureDesktopDatabase(desktopDbPath);
  const jwtSecret = ensureDesktopJwtSecret(userDataPath);
  const packagedGoogleClientId = readPackagedGoogleClientId();
  if (localServerStarted) return localServerUrl;

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    STATIC_DIST_PATH: getPackagedDistPath(),
    DATABASE_URL: process.env.DATABASE_URL || `file:${desktopDbPath.replace(/\\/g, '/')}`,
    JWT_SECRET: jwtSecret,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || process.env.NEXA_GOOGLE_CLIENT_ID || packagedGoogleClientId || '',
  };
  Object.assign(process.env, env);
  delete process.env.ELECTRON_RUN_AS_NODE;
  installPackagedPrismaResolver(logPath);

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n[${new Date().toISOString()}] Starting local server ${serverPath} on ${port} in Electron main\n`);
  logStream.write(`[${new Date().toISOString()}] Google Sign-In ${env.GOOGLE_CLIENT_ID ? 'enabled' : 'disabled'} for local server\n`);
  logStream.end();

  try {
    require(serverPath);
    localServerStarted = true;
  } catch (error) {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Require error: ${error.stack || error}\n`);
    console.error('Failed to start local Nexa server:', error);
    return null;
  }

  const candidateUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await testServerConnection(candidateUrl)) {
      localServerUrl = candidateUrl;
      saveServerUrl(candidateUrl);
      return localServerUrl;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.error('Local Nexa server did not become healthy in time.');
  return null;
}

// Function to check if a URL is active and healthy
function testServerConnection(urlToTest) {
  return new Promise((resolve) => {
    try {
      if (!urlToTest) return resolve(false);
      const parsedUrl = new URL(urlToTest);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      // Target the precise /api/health endpoint we added to the server
      const cleanPath = parsedUrl.pathname.endsWith('/') ? parsedUrl.pathname : parsedUrl.pathname + '/';
      const healthPath = cleanPath + 'api/health';

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: healthPath,
        method: 'GET',
        timeout: 3500,
        headers: {
          'Host': parsedUrl.host,
          'User-Agent': 'Mozilla/5.0 Nexa-Desktop-Tester'
        },
        rejectUnauthorized: false // Ignore self-signed/proxy SSL cert issues during connection test
      };

      const req = protocol.request(options, (res) => {
        // If we get ANY response from the server, it is physically up!
        // We accept 200 (OK), 3xx (Redirects - extremely common for OAuth/Google reverse-proxies), 
        // and 401/403 (Auth required - shows the secure endpoint is up and responding)
        const isUp = (res.statusCode >= 200 && res.statusCode < 400) || res.statusCode === 401 || res.statusCode === 403;
        resolve(isUp); 
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    } catch (err) {
      resolve(false);
    }
  });
}

// Sleek cyan message bubble icon as an embedded 32x32 PNG fallback for robust performance across all OS platforms
const EMBEDDED_ICON_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAByklEQVRYR+2WwUpDMRCGp8XehbvsK9SFrqXgA0R8gh7Fp3AnXbiXgqAIXbvyAn0An6CIouAnqFvBvYIuFf8Z0pI0bZObm6SDoX8IDGfS+fJnMr80vby8vLy8vPwPr6X2FhFr6nMyKGeDWeVd21D/BfQA8wM6AnrSgB+gUat/DpwAL8A7cALcm1hG0iHwBNyrXFkZpG/TzBvAtYlmAEx7Hn9u3gIuDYA/pZ2G6vX6IHAAnHeorX9V4gE21OfpWrcbAL6AmSbeZq4pBscvC8gAnIuY521NnU/O05p8E/Eon7v2M5C/S/tD+6oD7GpiY6u7Zcoq4gO98D6mGgV7AtgDDoCWehdwO3R/0L4BzoArZc0D+D2S637fAvY90R9FvDcoZ4R4eRzI4yG9O77Z5E69ItoR6Z0B79bE3DkG0H7bE+1OvevC7f8ArN0H/pY0LAnV9G0O5bXgO92rSNoHToFvXb6R3mB9fR0ZUPt+F8B9C67SvsvefP1O6WfcgM4An39N7d81gH3Gg0q9Wp+y/i3w0L6SvsfeP6n9m9KPsPZtAsCWehe/f0Lp+0Sgq2P7p8vLy8vLy8vLP/IG/m9/AdB9TbeF29U3AAAAAElFTkSuQmCC';

// Safe icon generator which handles any file missing or unsupported gracefully.
function getAppIcon() {
  const iconCandidates = [
    app.isPackaged ? path.join(process.resourcesPath, 'build', 'nexa-logo.ico') : null,
    path.join(__dirname, 'build', 'nexa-logo.ico'),
    path.join(__dirname, 'public', 'nexa-logo.svg'),
  ].filter(Boolean);

  for (const iconPath of iconCandidates) {
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (img && !img.isEmpty()) {
        return img;
      }
    } catch (err) {
      console.warn('Failed to load app icon candidate:', iconPath, err);
    }
  }

  return nativeImage.createFromDataURL(EMBEDDED_ICON_BASE64);
}

function isGoogleAuthPopupUrl(urlToCheck) {
  try {
    const parsedUrl = new URL(urlToCheck);
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'accounts.google.com';
  } catch {
    return false;
  }
}

function readPackagedGoogleClientId() {
  try {
    const runtimeConfigPath = path.join(getPackagedDistPath(), 'runtime-config.json');
    if (!fs.existsSync(runtimeConfigPath)) return '';
    const config = JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8'));
    const clientId = typeof config.googleClientId === 'string' ? config.googleClientId.trim() : '';
    return clientId.endsWith('.apps.googleusercontent.com') ? clientId : '';
  } catch {
    return '';
  }
}

// Perform active discovery to check which URL is live
async function findActiveServerUrl() {
  // 1. Saved non-local server URL. Prefer this so desktop and mobile stay on the same backend.
  const savedUrl = getSavedServerUrl();
  const savedUrlIsLoopback = savedUrl ? isLoopbackServerUrl(savedUrl) : false;
  if (savedUrl && !savedUrlIsLoopback && await testServerConnection(savedUrl)) {
    return savedUrl;
  }

  // 2. Default remote Nexa server. This prevents stale desktop localhost configs from splitting PC/phone sync.
  if (await testServerConnection(DEFAULT_REMOTE_SERVER_URL)) {
    if (savedUrlIsLoopback) {
      saveServerUrl(DEFAULT_REMOTE_SERVER_URL);
    }
    return DEFAULT_REMOTE_SERVER_URL;
  }

  // 3. Saved loopback/local URL only if the shared server is unavailable.
  if (savedUrl && await testServerConnection(savedUrl)) {
    return savedUrl;
  }

  // 4. Packaged local server for standalone desktop mode.
  const packagedUrl = await startLocalServer();
  if (packagedUrl) {
    return packagedUrl;
  }

  // 5. Localhost Server (port 3000 is our template's default)
  const localUrl = 'http://localhost:3000';
  if (await testServerConnection(localUrl)) {
    return localUrl;
  }

  // 6. active development URL on AI Studio container
  const devUrl = 'https://ais-dev-7bgky7op2qkpdmgoz7hysn-816012459690.europe-west2.run.app';
  if (await testServerConnection(devUrl)) {
    return devUrl;
  }

  // 7. production URL
  const preUrl = 'https://ais-pre-7bgky7op2qkpdmgoz7hysn-816012459690.europe-west2.run.app';
  if (await testServerConnection(preUrl)) {
    return preUrl;
  }

  // No active server found. Do not open a manual connection settings screen.
  return 'http://localhost:3000';
}

async function createMainWindow() {
  logMainEvent(`Creating main window. packaged=${app.isPackaged} dirname=${__dirname} resources=${process.resourcesPath || ''}`);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Nexa Messenger',
    backgroundColor: '#0F0F10', // Match Nexa background color
    show: false, // Prevents white flash on load
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js')
    },
    icon: getAppIcon()
  });

  // Setup IPC Handlers before loading any page
  setupIpcHandlers();

  const showMainWindow = (reason) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    logMainEvent(`Showing main window: ${reason}`);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  const startupRevealTimer = setTimeout(() => {
    showMainWindow('startup fallback timer');
  }, 4500);

  const clearStartupRevealTimer = () => {
    clearTimeout(startupRevealTimer);
  };

  mainWindow.once('ready-to-show', () => {
    clearStartupRevealTimer();
    showMainWindow('ready-to-show');
  });

  mainWindow.webContents.once('did-finish-load', () => {
    clearStartupRevealTimer();
    showMainWindow('did-finish-load');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logMainEvent(`Renderer failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
    showMainWindow('did-fail-load');
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logMainEvent(`Renderer process gone: ${JSON.stringify(details)}`);
    showMainWindow('render-process-gone');
  });

  mainWindow.on('unresponsive', () => {
    logMainEvent('Main window became unresponsive');
    showMainWindow('unresponsive');
  });

  let urlToLoad = '';

  // Packaged desktop must load the bundled UI, not a remote web page. The UI talks to the configured backend via API.
  if (app.isPackaged) {
    const activeUrl = await findActiveServerUrl();
    if (activeUrl) saveServerUrl(activeUrl);
    const uiUrl = getPackagedUiUrl(activeUrl);
    urlToLoad = uiUrl.toString();
    logMainEvent(`Loading bundled Nexa desktop UI: ${urlToLoad}`);
  } else {
    const activeUrl = await findActiveServerUrl();
    if (activeUrl) {
      logMainEvent(`Connecting Nexa to active server: ${activeUrl}`);
      urlToLoad = activeUrl;
    } else {
      logMainEvent('No active servers found. Loading default Nexa URL...');
      urlToLoad = 'http://localhost:3000';
    }
  }

  try {
    await mainWindow.loadURL(urlToLoad);
  } catch (error) {
    logMainEvent(`loadURL failed for ${urlToLoad}:`, error);
    const fallbackHtml = encodeURIComponent(`
      <html>
        <body style="margin:0;background:#071323;color:white;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
          <div>
            <h2>NEXA Messenger</h2>
            <p>Не удалось открыть интерфейс приложения.</p>
            <p style="color:#89a">Подробности записаны в desktop-main.log.</p>
          </div>
        </body>
      </html>
    `);
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${fallbackHtml}`);
    showMainWindow('fallback error page');
  }

  // Handle link clicking to open in external browser, while keeping Google OAuth popups attached to Nexa.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleAuthPopupUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          minWidth: 420,
          minHeight: 560,
          title: 'Вход через Google',
          parent: mainWindow,
          modal: false,
          backgroundColor: '#101113',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    }

    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('close', () => {
    isQuitting = true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    const trayIcon = getAppIcon();
    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Nexa',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createMainWindow();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Nexa Messenger');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize tray safely, continuing application flow:', error);
  }
}

// Setup IPC Message handlers from React / Settings page
function setupIpcHandlers() {
  // Clear any existing listeners first to prevent duplicates on manual reloads
  ipcMain.removeHandler('get-media-devices');
  ipcMain.removeHandler('media:request-permission');
  ipcMain.removeHandler('server:get-saved-url');
  ipcMain.removeHandler('server:test-url');
  ipcMain.removeHandler('server:save-url');

  ipcMain.handle('media:request-permission', async () => true);

  // Device enumeration must happen in the renderer, where navigator.mediaDevices exists.
  ipcMain.handle('get-media-devices', async () => []);

  ipcMain.handle('server:get-saved-url', async () => getSavedServerUrl() || DEFAULT_REMOTE_SERVER_URL);

  ipcMain.handle('server:test-url', async (_event, url) => testServerConnection(url));

  ipcMain.handle('server:save-url', async (_event, url) => {
    if (typeof url !== 'string' || !url.trim()) {
      return false;
    }
    const normalizedUrl = url.trim().replace(/\/$/, '');
    saveServerUrl(normalizedUrl);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (app.isPackaged) {
        mainWindow.loadURL(getPackagedUiUrl(normalizedUrl).toString());
      } else {
        mainWindow.loadURL(normalizedUrl);
      }
    }
    return true;
  });
}

// Set up App Menu
function setAppMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Переподключиться',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reload();
          },
        },
        { type: 'separator' },
        {
          label: 'Выйти из Nexa',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выбрать все' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить страницу' },
        { role: 'forceReload', label: 'Очистить кэш и обновить' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полноэкранный режим' },
      ],
    },
    {
      label: 'Помощь',
      submenu: [
        {
          label: 'О приложении Nexa',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              type: 'info',
              title: 'О Nexa Desktop',
              message: 'Nexa Messenger для Windows',
              detail: 'Версия 1.0.0\nБезопасный и быстрый современный мессенджер.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function getPermissionRequestOrigin(webContents, details) {
  try {
    const requestUrl = details?.requestingUrl || details?.embeddingOrigin || webContents.getURL();
    return new URL(requestUrl).origin;
  } catch {
    return null;
  }
}

function isTrustedMediaPermissionRequest(webContents, details) {
  if (!mainWindow || webContents !== mainWindow.webContents) return false;

  try {
    const currentUrl = new URL(webContents.getURL());
    const requestOrigin = getPermissionRequestOrigin(webContents, details);
    if (app.isPackaged && currentUrl.protocol === 'file:') {
      return true;
    }
    return Boolean(
      requestOrigin &&
      ['http:', 'https:'].includes(currentUrl.protocol) &&
      requestOrigin === currentUrl.origin
    );
  } catch {
    return false;
  }
}

async function confirmMediaPermission(webContents, permission, details) {
  const origin = getPermissionRequestOrigin(webContents, details) || (app.isPackaged ? 'nexa-desktop' : null);
  if (!origin || !isTrustedMediaPermissionRequest(webContents, details)) {
    console.warn(`[Electron] Permission denied from untrusted context: ${permission}`);
    return false;
  }

  const cacheKey = `${origin}:${permission}`;
  if (mediaPermissionDecisions.has(cacheKey)) {
    return mediaPermissionDecisions.get(cacheKey);
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Разрешить', 'Запретить'],
    defaultId: 1,
    cancelId: 1,
    title: 'Доступ к устройствам',
    message: 'Nexa запрашивает доступ к камере или микрофону',
    detail: `Источник: ${origin}\nРазрешение: ${permission}`,
    noLink: true,
  });

  const allowed = result.response === 0;
  mediaPermissionDecisions.set(cacheKey, allowed);
  console.log(`[Electron] Permission ${allowed ? 'granted' : 'denied'}: ${permission} (${origin})`);
  return allowed;
}
// Single instance lock to prevent launching multiple copies of the desktop app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logMainEvent('Single instance lock is already held. Quitting this instance.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    logMainEvent(`App ready. argv=${JSON.stringify(process.argv)}`);
    // Ask before granting camera/microphone access and only trust the active Nexa window origin.
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      if (!MEDIA_PERMISSIONS.has(permission)) {
        console.log(`[Electron] Permission denied: ${permission}`);
        callback(false);
        return;
      }

      confirmMediaPermission(webContents, permission, details)
        .then(callback)
        .catch((error) => {
          console.warn(`[Electron] Permission prompt failed for ${permission}:`, error);
          callback(false);
        });
    });

    await createMainWindow();
    createTray();
    setAppMenu();
    session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage'],
    }).catch((error) => {
      console.warn('Failed to clear Electron web cache:', error);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  }).catch((error) => {
    logMainEvent('App startup failed:', error);
    app.quit();
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

