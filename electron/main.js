const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const PWA_URL = 'https://nalichat.org';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'NaliChat',
    backgroundColor: '#0f0a14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Remove default menu bar for a cleaner app experience
  Menu.setApplicationMenu(null);

  // Show window only when page is ready (prevents white flash)
  win.once('ready-to-show', () => win.show());

  // Open external links in the default browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Show error page if the PWA fails to load (offline / server down)
  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    if (errorCode === -3) return; // ERR_ABORTED — navigation cancelled, ignore
    console.error('Load failed:', errorCode, errorDescription);
    win.loadFile(path.join(__dirname, 'error.html'));
  });

  win.loadURL(PWA_URL);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});