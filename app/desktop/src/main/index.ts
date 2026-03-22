import { config } from 'dotenv';
import path from 'path';

// Load .env from monorepo root before anything else
config({ path: path.resolve(__dirname, '../../../../.env') });

import { app, BrowserWindow, ipcMain } from 'electron';
import { registerIpcHandlers, cleanupSessions } from './ipc-handlers';

// Disable GPU acceleration to prevent SIGSEGV crashes on some systems
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;
let calendarWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;
const preloadPath = path.join(__dirname, 'preload.js');

function getBaseUrl(): string {
  if (isDev) return 'http://localhost:5173';
  return `file://${path.join(__dirname, '../renderer/index.html')}`;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Mark2',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.close();
    }
    if (calendarWindow && !calendarWindow.isDestroyed()) {
      calendarWindow.close();
    }
  });
}

function createChatWindow(agent: string): void {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.focus();
    return;
  }

  // Position to the right of the main window
  const mainBounds = mainWindow?.getBounds();
  const x = mainBounds ? mainBounds.x + mainBounds.width + 8 : undefined;
  const y = mainBounds?.y;

  chatWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x,
    y,
    minWidth: 320,
    minHeight: 400,
    title: `Chat — ${agent}`,
    alwaysOnTop: true,
    frame: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
    },
  });

  const base = getBaseUrl();
  const url = isDev
    ? `${base}#/chat-popout/${agent}`
    : `${base}#/chat-popout/${agent}`;

  chatWindow.loadURL(url);

  chatWindow.on('closed', () => {
    chatWindow = null;
    // Notify main window that chat was closed (popped back in)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:popped-in');
    }
  });
}

// === Calendar popout ===

function createCalendarWindow(): void {
  if (calendarWindow && !calendarWindow.isDestroyed()) {
    calendarWindow.focus();
    return;
  }

  const mainBounds = mainWindow?.getBounds();
  const x = mainBounds ? mainBounds.x + mainBounds.width + 8 : undefined;
  const y = mainBounds?.y;

  calendarWindow = new BrowserWindow({
    width: 500,
    height: 600,
    x,
    y,
    minWidth: 400,
    minHeight: 400,
    title: 'Calendar',
    alwaysOnTop: true,
    frame: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
    },
  });

  const base = getBaseUrl();
  calendarWindow.loadURL(`${base}#/calendar-popout`);

  calendarWindow.on('closed', () => {
    calendarWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('calendar:popped-in');
    }
  });
}

ipcMain.handle('calendar:popout', () => {
  createCalendarWindow();
  return true;
});

ipcMain.handle('calendar:popin', () => {
  if (calendarWindow && !calendarWindow.isDestroyed()) {
    calendarWindow.close();
    calendarWindow = null;
  }
  return true;
});

// === Chat popout IPC ===

ipcMain.handle('chat:popout', (_event, agent: string) => {
  createChatWindow(agent);
  return true;
});

ipcMain.handle('chat:popin', () => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.close();
    chatWindow = null;
  }
  return true;
});

// === Data change relay ===

ipcMain.on('data-changed', (_event, entities: string[]) => {
  // Broadcast to all windows
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('data-changed', entities);
    }
  }
});

// === App lifecycle ===

app.on('ready', () => {
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  cleanupSessions();
});
