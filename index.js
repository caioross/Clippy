const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const os = require('os');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');

let activeWin;
let tray = null;
let mainWindow = null;

(async () => {
    try {
        activeWin = (await import('active-win')).default;
    } catch (e) { console.error("Failed to load active-win", e); }
})();

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const win = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.setIgnoreMouseEvents(true, { forward: true });

    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        const webContents = event.sender;
        const window = BrowserWindow.fromWebContents(webContents);
        if (window) {
            window.setIgnoreMouseEvents(ignore, options);
        }
    });

    // Provide OS Context to React
    ipcMain.handle('get-system-context', async () => {
        let activeTitle = "Unknown";
        if (activeWin) {
            try {
                const aw = await activeWin();
                if (aw) activeTitle = aw.title + " (" + aw.owner.name + ")";
            } catch (e) { }
        }

        return {
            platform: os.platform(),
            cpuLayout: os.cpus()[0]?.model,
            freeMem: Math.round(os.freemem() / 1024 / 1024) + "MB",
            totalMem: Math.round(os.totalmem() / 1024 / 1024) + "MB",
            activeWindow: activeTitle,
            time: new Date().toLocaleTimeString()
        };
    });

    // Setup Global Shortcut to Wake
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
        win.webContents.send('global-shortcut-wake');
    });

    // Setup Tray
    const iconBase64 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkoBAwUqifYdQAyXDI0ODg/x/GZ0QyEGwg2ICcnBwGg4MDFhYWP1E2EAw0MDDg4+P7T4oBYAMxDQDRDTIQwgZIgyYkJIQn2EDMw8MDiG4gRMDQAD09Pfzhhw/uSAYCABTzG0X6Wv1hAAAAAElFTkSuQmCC";
    const icon = nativeImage.createFromDataURL(`data:image/png;base64,${iconBase64}`);
    tray = new Tray(icon);
    tray.setToolTip('Clippy Assistant');
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Wake / Sleep', type: 'normal', click: () => win.webContents.send('global-shortcut-wake') },
        { label: 'Settings', type: 'normal', click: () => win.webContents.send('open-settings') },
        { label: 'Quit', role: 'quit' }
    ]);
    tray.setContextMenu(contextMenu);

    // Auto launch
    app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe')
    });

    // Load App
    if (isDev) {
        win.loadURL('http://localhost:5173');
    } else {
        win.loadFile(path.join(__dirname, 'client', 'dist', 'index.html'));
    }

    mainWindow = win;
}

app.whenReady().then(createWindow);

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});