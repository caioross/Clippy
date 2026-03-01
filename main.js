const { app, BrowserWindow, screen } = require('electron');

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const win = new BrowserWindow({
        width: 300,
        height: 300,
        x: width - 320,
        y: height - 320,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html'); // Ele vai carregar o HTML aqui
}

app.whenReady().then(createWindow);