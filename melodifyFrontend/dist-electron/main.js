import { spawn } from "node:child_process";
import { app, BrowserWindow, nativeImage, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promises } from "node:fs";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".m4b",
  ".mp3",
  ".ogg",
  ".oga",
  ".opus",
  ".wav",
  ".webm"
]);
const MIME_BY_EXTENSION = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".m4b": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".wav": "audio/wav",
  ".webm": "audio/webm"
};
const SUPPORTED_COOKIE_BROWSERS = /* @__PURE__ */ new Set(["chrome", "chromium", "edge", "firefox", "brave", "opera"]);
const STATE_FILE_NAME = "melodify-state.json";
const APP_ICON_FILE_NAME = "melodify-icon.png";
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
  app.quit();
}
function getStateFilePath() {
  return path.join(app.getPath("userData"), STATE_FILE_NAME);
}
function getPublicAssetPath(fileName) {
  return path.join(process.env.VITE_PUBLIC, fileName);
}
function createThumbarIcon(fileName) {
  return nativeImage.createFromPath(getPublicAssetPath(fileName));
}
const thumbarIcons = {
  next: createThumbarIcon("thumbar-next.png"),
  pause: createThumbarIcon("thumbar-pause.png"),
  play: createThumbarIcon("thumbar-play.png"),
  previous: createThumbarIcon("thumbar-previous.png")
};
function sendMediaCommand(command) {
  win == null ? void 0 : win.webContents.send("media:command", command);
}
function updateTaskbarMediaControls(state) {
  if (!win || process.platform !== "win32") {
    return;
  }
  const flags = ["enabled"];
  win.setThumbarButtons([
    {
      tooltip: "Previous track",
      icon: thumbarIcons.previous,
      click: () => sendMediaCommand("previous"),
      flags
    },
    {
      tooltip: state.isPlaying ? "Pause" : "Play",
      icon: state.isPlaying ? thumbarIcons.pause : thumbarIcons.play,
      click: () => sendMediaCommand("play-pause"),
      flags
    },
    {
      tooltip: "Next track",
      icon: thumbarIcons.next,
      click: () => sendMediaCommand("next"),
      flags
    }
  ]);
}
async function readState() {
  try {
    const raw = await promises.readFile(getStateFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      lastLibraryFolder: typeof parsed.lastLibraryFolder === "string" ? parsed.lastLibraryFolder : void 0,
      lastDownloadFolder: typeof parsed.lastDownloadFolder === "string" ? parsed.lastDownloadFolder : void 0
    };
  } catch {
    return {};
  }
}
async function writeState(nextState) {
  await promises.mkdir(path.dirname(getStateFilePath()), { recursive: true });
  await promises.writeFile(getStateFilePath(), JSON.stringify(nextState, null, 2), "utf8");
}
async function updateState(patch) {
  const currentState = await readState();
  await writeState({ ...currentState, ...patch });
}
async function pathExists(targetPath) {
  try {
    await promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
function isSupportedMusicFile(fileName) {
  return SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}
function getMimeType(filePath) {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) {
    return "Bilinmiyor";
  }
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
function normalizeDownloadFolder(folderPath) {
  return path.resolve(folderPath);
}
function normalizeCookieBrowser(browserName) {
  const value = browserName == null ? void 0 : browserName.trim().toLowerCase();
  if (!value) {
    return null;
  }
  return SUPPORTED_COOKIE_BROWSERS.has(value) ? value : null;
}
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    var _a, _b;
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    (_a = child.stdout) == null ? void 0 : _a.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    (_b = child.stderr) == null ? void 0 : _b.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || `Komut hata ile sonlandi. Kod: ${code ?? "bilinmiyor"}`));
    });
  });
}
function getYouTubeWatchUrl(videoIdOrUrl) {
  if (videoIdOrUrl.startsWith("http://") || videoIdOrUrl.startsWith("https://")) {
    return videoIdOrUrl;
  }
  return `https://www.youtube.com/watch?v=${videoIdOrUrl}`;
}
function formatCommandOutput(stdout, stderr) {
  return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
}
async function getYtDlpVersion() {
  const { stdout } = await runCommand("yt-dlp", ["--version"]);
  return stdout.trim();
}
async function updateYtDlp() {
  const previousVersion = await getYtDlpVersion();
  const { stdout, stderr } = await runCommand("yt-dlp", ["-U"]);
  const currentVersion = await getYtDlpVersion();
  return {
    previousVersion,
    currentVersion,
    updated: previousVersion !== currentVersion,
    output: formatCommandOutput(stdout, stderr)
  };
}
async function collectMusicFiles(rootFolder) {
  const tracks = [];
  async function visitDirectory(folderPath) {
    let entries;
    try {
      entries = await promises.readdir(folderPath, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, void 0, { numeric: true, sensitivity: "base" }));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const absolutePath = path.join(folderPath, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        await visitDirectory(absolutePath);
        continue;
      }
      if (!entry.isFile() || !isSupportedMusicFile(entry.name)) {
        continue;
      }
      const extension = path.extname(entry.name);
      const fileStat = await promises.stat(absolutePath);
      tracks.push({
        id: absolutePath,
        title: path.basename(entry.name, extension),
        fileName: entry.name,
        filePath: absolutePath,
        extension: extension.replace(/^\./, "").toLowerCase(),
        modifiedTimeMs: fileStat.mtimeMs
      });
    }
  }
  await visitDirectory(rootFolder);
  tracks.sort(
    (left, right) => left.filePath.localeCompare(right.filePath, void 0, {
      numeric: true,
      sensitivity: "base"
    })
  );
  return tracks;
}
async function buildLibrarySnapshot(folderPath) {
  return {
    folderPath,
    tracks: await collectMusicFiles(folderPath)
  };
}
async function loadLastLibrarySnapshot() {
  const state = await readState();
  if (!state.lastLibraryFolder) {
    return null;
  }
  if (!await pathExists(state.lastLibraryFolder)) {
    return null;
  }
  return buildLibrarySnapshot(state.lastLibraryFolder);
}
async function loadLastDownloadFolder() {
  const state = await readState();
  return state.lastDownloadFolder ?? null;
}
async function pickMusicFolder() {
  const result = await dialog.showOpenDialog({
    title: "Müzik klasörü seç",
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const folderPath = result.filePaths[0];
  const snapshot = await buildLibrarySnapshot(folderPath);
  await updateState({ lastLibraryFolder: folderPath });
  return {
    canceled: false,
    snapshot
  };
}
async function pickDownloadFolder() {
  const result = await dialog.showOpenDialog({
    title: "İndirme klasörü seç",
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const folderPath = normalizeDownloadFolder(result.filePaths[0]);
  await updateState({ lastDownloadFolder: folderPath });
  return {
    canceled: false,
    folderPath
  };
}
async function searchWithYtDlp(request) {
  const query = request.query.trim();
  if (!query) {
    return [];
  }
  const limit = Math.max(1, Math.min(20, request.limit ?? 10));
  const { stdout } = await runCommand("yt-dlp", [
    "--flat-playlist",
    "--dump-single-json",
    "--no-warnings",
    `ytsearch${limit}:${query}`
  ]);
  const parsed = JSON.parse(stdout);
  return (parsed.entries ?? []).filter((entry) => Boolean(entry.id || entry.url || entry.webpage_url)).map((entry, index) => {
    var _a, _b;
    const idOrUrl = entry.id ?? entry.url ?? `${index}`;
    return {
      id: idOrUrl,
      title: entry.title ?? "Başlıksız sonuç",
      uploader: entry.uploader ?? entry.channel ?? "Bilinmiyor",
      durationText: formatDuration(entry.duration),
      webpageUrl: entry.webpage_url ?? getYouTubeWatchUrl(idOrUrl),
      thumbnailUrl: entry.thumbnail ?? ((_b = (_a = entry.thumbnails) == null ? void 0 : _a[0]) == null ? void 0 : _b.url) ?? ""
    };
  });
}
async function downloadWithYtDlp(request) {
  const downloadFolderPath = normalizeDownloadFolder(request.downloadFolderPath);
  const cookiesBrowser = normalizeCookieBrowser(request.cookiesFromBrowser);
  await promises.mkdir(downloadFolderPath, { recursive: true });
  const args = [
    "--no-warnings",
    "--newline",
    "--extract-audio",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "--restrict-filenames",
    "--paths",
    `home:${downloadFolderPath}`,
    "--output",
    "%(title)s [%(id)s].%(ext)s",
    "--print",
    "after_move:filepath"
  ];
  if (cookiesBrowser) {
    args.push("--cookies-from-browser", cookiesBrowser);
  }
  args.push(request.webpageUrl);
  const { stdout } = await runCommand("yt-dlp", args);
  const outputLines = stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const lastOutputLine = outputLines[outputLines.length - 1];
  if (!lastOutputLine) {
    throw new Error("Yukleme tamamlandi ama cikis dosyasi bulunamadi.");
  }
  return {
    fileName: path.basename(lastOutputLine),
    outputPath: lastOutputLine
  };
}
async function loadTrackPayload(filePath) {
  try {
    const data = await promises.readFile(filePath);
    return {
      fileName: path.basename(filePath),
      mimeType: getMimeType(filePath),
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    };
  } catch {
    return null;
  }
}
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#0b1018",
    icon: getPublicAssetPath(APP_ICON_FILE_NAME),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  updateTaskbarMediaControls({ isPlaying: false });
  win.on("closed", () => {
    win = null;
  });
}
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
    return;
  }
  createWindow();
});
function registerIpcHandlers() {
  ipcMain.handle("library:pick-folder", async () => pickMusicFolder());
  ipcMain.handle("library:load-last", async () => loadLastLibrarySnapshot());
  ipcMain.handle("library:load-last-download-folder", async () => loadLastDownloadFolder());
  ipcMain.handle("library:pick-download-folder", async () => pickDownloadFolder());
  ipcMain.handle("library:load-track-payload", async (_event, filePath) => loadTrackPayload(filePath));
  ipcMain.handle("yt-dlp:search", async (_event, request) => searchWithYtDlp(request));
  ipcMain.handle("yt-dlp:update", async () => updateYtDlp());
  ipcMain.on("media:state", (_event, state) => {
    updateTaskbarMediaControls(state);
  });
  ipcMain.handle("yt-dlp:download", async (_event, request) => {
    await updateState({
      lastDownloadFolder: normalizeDownloadFolder(request.downloadFolderPath)
    });
    return downloadWithYtDlp(request);
  });
}
if (isPrimaryInstance) {
  app.whenReady().then(() => {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.yhcanbay.melodify");
    }
    registerIpcHandlers();
    createWindow();
  });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
