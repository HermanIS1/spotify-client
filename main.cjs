const { app, BrowserWindow } = require("electron");
const path = require("path");

// Widevine / EME — required for Spotify Web Playback SDK audio in Electron
app.commandLine.appendSwitch(
  "enable-features",
  "WidevineCdm,PlatformHEVCDecoderSupport,EncryptedMedia",
);
app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#050a06",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
  } else {
    mainWindow.loadURL("http://127.0.0.1:5173");
  }

  // ─── NOWY KOD: PRZECHWYTYWANIE LOGOWANIA SPOTIFY ───
  function handleSpotifyCallback(event, url) {
    if (url.startsWith("http://127.0.0.1:5173/callback")) {
      event.preventDefault(); // Blokujemy wejście w "pusty" adres

      const urlObj = new URL(url);
      const code = urlObj.searchParams.get("code");

      // Wstrzykujemy kod logowania z powrotem do naszej załadowanej apki
      if (app.isPackaged) {
        mainWindow.loadURL(
          `file://${path.join(__dirname, "dist", "index.html")}?code=${code}`,
        );
      } else {
        mainWindow.loadURL(`http://127.0.0.1:5173/?code=${code}`);
      }
    }
  }

  mainWindow.webContents.on("will-navigate", handleSpotifyCallback);
  mainWindow.webContents.on("will-redirect", handleSpotifyCallback);
  // ───────────────────────────────────────────────────

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
