const { app, BrowserWindow, Menu, Tray, ipcMain, shell, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

let mainWindow;
let tray;
let isQuitting = false;

// Config file path for persistent settings
const configPath = path.join(app.getPath('userData'), 'nexa-config.json');

// Get saved URL from config file or return default candidate array
function getSavedServerUrl() {
  try {
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
    fs.writeFileSync(configPath, JSON.stringify({ serverUrl: url }), 'utf8');
  } catch (e) {
    console.error('Error writing config:', e);
  }
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

// Safe icon generator which handles any file missing or unsupported gracefully (e.g. SVG on Windows)
function getAppIcon() {
  try {
    const iconPath = path.join(__dirname, 'public', 'vite.svg');
    const img = nativeImage.createFromPath(iconPath);
    if (img && !img.isEmpty()) {
      return img;
    }
  } catch (err) {
    console.warn('Failed to load local icon file, using embedded fallback:', err);
  }
  return nativeImage.createFromDataURL(EMBEDDED_ICON_BASE64);
}

// Perform active discovery to check which URL is live
async function findActiveServerUrl() {
  // 1. Saved Custom Server URL
  const savedUrl = getSavedServerUrl();
  if (savedUrl && await testServerConnection(savedUrl)) {
    return savedUrl;
  }

  // 2. Localhost Server (port 3000 is our template's default)
  const localUrl = 'http://localhost:3000';
  if (await testServerConnection(localUrl)) {
    return localUrl;
  }

  // 3. active development URL on AI Studio container
  const devUrl = 'https://ais-dev-7bgky7op2qkpdmgoz7hysn-816012459690.europe-west2.run.app';
  if (await testServerConnection(devUrl)) {
    return devUrl;
  }

  // 4. production URL
  const preUrl = 'https://ais-pre-7bgky7op2qkpdmgoz7hysn-816012459690.europe-west2.run.app';
  if (await testServerConnection(preUrl)) {
    return preUrl;
  }

  // No active online server found, fallback to settings interface
  return null;
}

async function createMainWindow() {
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

  // Load appropriate URL or locally fallback
  const activeUrl = await findActiveServerUrl();
  if (activeUrl) {
    console.log(`Connecting Nexa to active server: ${activeUrl}`);
    mainWindow.loadURL(activeUrl);
  } else {
    console.log('No active servers found. Opening Connection Panel...');
    mainWindow.loadFile(path.join(__dirname, 'electron-settings.html'));
  }

  // Show window when content is loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle link clicking to open in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Instead of closing, minimize to system tray (unless quitting the app)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
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
  ipcMain.removeAllListeners('save-url');
  ipcMain.removeHandler('test-url');
  ipcMain.removeHandler('get-saved-url');
  ipcMain.removeHandler('get-media-devices');
  ipcMain.removeHandler('media:request-permission');

  ipcMain.on('save-url', (event, url) => {
    console.log(`Saving custom server URL to local config: ${url}`);
    saveServerUrl(url);
    if (mainWindow) {
      mainWindow.loadURL(url);
    }
  });

  ipcMain.handle('test-url', async (event, url) => {
    console.log(`Testing connection strength to: ${url}`);
    return await testServerConnection(url);
  });

  ipcMain.handle('get-saved-url', async () => {
    return getSavedServerUrl() || 'http://localhost:3000';
  });

  ipcMain.handle('media:request-permission', async () => true);

  // Device enumeration must happen in the renderer, where navigator.mediaDevices exists.
  ipcMain.handle('get-media-devices', async () => []);
}

// Set up App Menu
function setAppMenu() {
  const currentUrl = getSavedServerUrl() || 'http://localhost:3000';
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Подключение (Настройки)',
          click: () => {
            if (mainWindow) {
              mainWindow.loadFile(path.join(__dirname, 'electron-settings.html'));
            }
          }
        },
        {
          label: 'Переподключиться',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reload();
          }
        },
        { type: 'separator' },
        {
          label: 'Выйти из Nexa',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
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
        { role: 'selectAll', label: 'Выбрать все' }
      ]
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
        { role: 'togglefullscreen', label: 'Полноэкранный режим' }
      ]
    },
    {
      label: 'Помощь',
      submenu: [
        {
          label: 'О приложении Nexa',
          click: async () => {
            const { dialog } = require('electron');
            const activeUrl = await findActiveServerUrl() || currentUrl;
            dialog.showMessageBox({
              type: 'info',
              title: 'О Nexa Desktop',
              message: 'Nexa Messenger для Windows',
              detail: `Версия 1.0.0\nБезопасный и быстрый современный мессенджер.\nАктивный адрес подключения: ${activeUrl}`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Single instance lock to prevent launching multiple copies of the desktop app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Setup permission handler for microphone and camera access
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['microphone', 'camera', 'media'];
      if (allowedPermissions.includes(permission)) {
        console.log(`[Electron] Permission granted: ${permission}`);
        callback(true);
      } else {
        console.log(`[Electron] Permission denied: ${permission}`);
        callback(false);
      }
    });

    createMainWindow();
    createTray();
    setAppMenu();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
