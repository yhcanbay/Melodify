import { spawn as Y } from "node:child_process";
import { app as f, BrowserWindow as N, nativeImage as z, ipcMain as p, dialog as g } from "electron";
import { fileURLToPath as K } from "node:url";
import c from "node:path";
import { promises as m } from "node:fs";
const C = c.dirname(K(import.meta.url)), J = /* @__PURE__ */ new Set([
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
]), H = {
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
}, q = /* @__PURE__ */ new Set(["chrome", "chromium", "edge", "firefox", "brave", "opera"]), X = "melodify-state.json", G = "melodify-icon.png";
process.env.APP_ROOT = c.join(C, "..");
const v = process.env.VITE_DEV_SERVER_URL, Ft = c.join(process.env.APP_ROOT, "dist-electron"), R = c.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = v ? c.join(process.env.APP_ROOT, "public") : R;
let r;
const $ = f.requestSingleInstanceLock();
$ || f.quit();
function L() {
  return c.join(f.getPath("userData"), X);
}
function B(t) {
  return c.join(process.env.VITE_PUBLIC, t);
}
function y(t) {
  return z.createFromPath(B(t));
}
const b = {
  next: y("thumbar-next.png"),
  pause: y("thumbar-pause.png"),
  play: y("thumbar-play.png"),
  previous: y("thumbar-previous.png")
};
function S(t) {
  r == null || r.webContents.send("media:command", t);
}
function U(t) {
  if (!r || process.platform !== "win32")
    return;
  const e = ["enabled"];
  r.setThumbarButtons([
    {
      tooltip: "Previous track",
      icon: b.previous,
      click: () => S("previous"),
      flags: e
    },
    {
      tooltip: t.isPlaying ? "Pause" : "Play",
      icon: t.isPlaying ? b.pause : b.play,
      click: () => S("play-pause"),
      flags: e
    },
    {
      tooltip: "Next track",
      icon: b.next,
      click: () => S("next"),
      flags: e
    }
  ]);
}
async function h() {
  try {
    const t = await m.readFile(L(), "utf8"), e = JSON.parse(t);
    return {
      lastLibraryFolder: typeof e.lastLibraryFolder == "string" ? e.lastLibraryFolder : void 0,
      lastDownloadFolder: typeof e.lastDownloadFolder == "string" ? e.lastDownloadFolder : void 0
    };
  } catch {
    return {};
  }
}
async function Q(t) {
  await m.mkdir(c.dirname(L()), { recursive: !0 }), await m.writeFile(L(), JSON.stringify(t, null, 2), "utf8");
}
async function E(t) {
  const e = await h();
  await Q({ ...e, ...t });
}
async function _(t) {
  try {
    return await m.access(t), !0;
  } catch {
    return !1;
  }
}
function Z(t) {
  return J.has(c.extname(t).toLowerCase());
}
function tt(t) {
  return H[c.extname(t).toLowerCase()] ?? "application/octet-stream";
}
function et(t) {
  if (!t || Number.isNaN(t))
    return "Bilinmiyor";
  const e = Math.max(0, Math.floor(t)), s = Math.floor(e / 3600), n = Math.floor(e % 3600 / 60), i = e % 60;
  return s > 0 ? `${s}:${String(n).padStart(2, "0")}:${String(i).padStart(2, "0")}` : `${n}:${String(i).padStart(2, "0")}`;
}
function D(t) {
  return c.resolve(t);
}
function at(t) {
  const e = t == null ? void 0 : t.trim().toLowerCase();
  return e && q.has(e) ? e : null;
}
function P(t, e) {
  return new Promise((s, n) => {
    var u, d;
    const i = Y(t, e, {
      shell: !1,
      windowsHide: !0
    });
    let a = "", l = "";
    (u = i.stdout) == null || u.on("data", (o) => {
      a += o.toString("utf8");
    }), (d = i.stderr) == null || d.on("data", (o) => {
      l += o.toString("utf8");
    }), i.on("error", (o) => {
      n(o);
    }), i.on("close", (o) => {
      if (o === 0) {
        s({ stdout: a, stderr: l });
        return;
      }
      n(new Error(l.trim() || `Komut hata ile sonlandi. Kod: ${o ?? "bilinmiyor"}`));
    });
  });
}
function nt(t) {
  return t.startsWith("http://") || t.startsWith("https://") ? t : `https://www.youtube.com/watch?v=${t}`;
}
function ot(t, e) {
  return [t.trim(), e.trim()].filter(Boolean).join(`
`);
}
async function O() {
  const { stdout: t } = await P("yt-dlp", ["--version"]);
  return t.trim();
}
async function rt() {
  const t = await O(), { stdout: e, stderr: s } = await P("yt-dlp", ["-U"]), n = await O();
  return {
    previousVersion: t,
    currentVersion: n,
    updated: t !== n,
    output: ot(e, s)
  };
}
async function x(t) {
  const e = [];
  async function s(n) {
    let i;
    try {
      i = await m.readdir(n, { withFileTypes: !0 });
    } catch {
      return;
    }
    i.sort((a, l) => a.name.localeCompare(l.name, void 0, { numeric: !0, sensitivity: "base" }));
    for (const a of i) {
      if (a.name.startsWith("."))
        continue;
      const l = c.join(n, a.name);
      if (a.isSymbolicLink())
        continue;
      if (a.isDirectory()) {
        await s(l);
        continue;
      }
      if (!a.isFile() || !Z(a.name))
        continue;
      const u = c.extname(a.name), d = await m.stat(l);
      e.push({
        id: l,
        title: c.basename(a.name, u),
        fileName: a.name,
        filePath: l,
        extension: u.replace(/^\./, "").toLowerCase(),
        modifiedTimeMs: d.mtimeMs
      });
    }
  }
  return await s(t), e.sort(
    (n, i) => n.filePath.localeCompare(i.filePath, void 0, {
      numeric: !0,
      sensitivity: "base"
    })
  ), e;
}
async function j(t) {
  return {
    folderPath: t,
    tracks: await x(t)
  };
}
async function it() {
  const t = await h();
  return !t.lastLibraryFolder || !await _(t.lastLibraryFolder) ? null : j(t.lastLibraryFolder);
}
async function st() {
  return (await h()).lastDownloadFolder ?? null;
}
async function lt() {
  const t = await g.showOpenDialog({
    title: "Müzik klasörü seç",
    properties: ["openDirectory"]
  });
  if (t.canceled || t.filePaths.length === 0)
    return { canceled: !0 };
  const e = t.filePaths[0], s = await j(e);
  return await E({ lastLibraryFolder: e }), {
    canceled: !1,
    snapshot: s
  };
}
async function ct() {
  const t = await g.showOpenDialog({
    title: "İndirme klasörü seç",
    properties: ["openDirectory"]
  });
  if (t.canceled || t.filePaths.length === 0)
    return { canceled: !0 };
  const e = D(t.filePaths[0]);
  return await E({ lastDownloadFolder: e }), {
    canceled: !1,
    folderPath: e
  };
}
async function ut(t) {
  const e = t.query.trim();
  if (!e)
    return [];
  const s = Math.max(1, Math.min(20, t.limit ?? 10)), { stdout: n } = await P("yt-dlp", [
    "--flat-playlist",
    "--dump-single-json",
    "--no-warnings",
    `ytsearch${s}:${e}`
  ]);
  return (JSON.parse(n).entries ?? []).filter((a) => !!(a.id || a.url || a.webpage_url)).map((a, l) => {
    var d, o;
    const u = a.id ?? a.url ?? `${l}`;
    return {
      id: u,
      title: a.title ?? "Başlıksız sonuç",
      uploader: a.uploader ?? a.channel ?? "Bilinmiyor",
      durationText: et(a.duration),
      webpageUrl: a.webpage_url ?? nt(u),
      thumbnailUrl: a.thumbnail ?? ((o = (d = a.thumbnails) == null ? void 0 : d[0]) == null ? void 0 : o.url) ?? ""
    };
  });
}
async function A(t) {
  const e = D(t.downloadFolderPath), s = at(t.cookiesFromBrowser);
  await m.mkdir(e, { recursive: !0 });
  const n = [
    "--no-warnings",
    "--newline",
    "--extract-audio",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "--restrict-filenames",
    "--paths",
    `home:${e}`,
    "--output",
    "%(title)s [%(id)s].%(ext)s",
    "--print",
    "after_move:filepath"
  ];
  s && n.push("--cookies-from-browser", s), n.push(t.webpageUrl);
  const { stdout: i } = await P("yt-dlp", n), a = i.split(`
`).map((u) => u.trim()).filter(Boolean), l = a[a.length - 1];
  if (!l)
    throw new Error("Yukleme tamamlandi ama cikis dosyasi bulunamadi.");
  return {
    fileName: c.basename(l),
    outputPath: l
  };
}
function V(t) {
  const e = t.match(/\[([^\]]+)\]\.[^.]+$/);
  return e ? e[1] : null;
}
async function dt() {
  const t = await h();
  if (!t.lastLibraryFolder || !await _(t.lastLibraryFolder))
    throw new Error("Dışa aktarılacak bir kütüphane klasörü bulunamadı.");
  const e = await x(t.lastLibraryFolder), s = {
    version: "1.0",
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    sourcePlatform: process.platform,
    tracks: e.map((i) => {
      const a = V(i.fileName);
      return {
        title: i.title,
        fileName: i.fileName,
        extension: i.extension,
        youtubeId: a,
        webpageUrl: a ? `https://www.youtube.com/watch?v=${a}` : null
      };
    })
  }, n = await g.showSaveDialog({
    title: "Kütüphaneyi dışa aktar",
    defaultPath: c.join(t.lastLibraryFolder, "melodify-library.json"),
    filters: [{ name: "Melodify Kütüphane", extensions: ["json"] }]
  });
  return n.canceled || !n.filePath ? { canceled: !0 } : (await m.writeFile(n.filePath, JSON.stringify(s, null, 2), "utf8"), { canceled: !1, filePath: n.filePath, trackCount: s.tracks.length });
}
async function pt() {
  const t = await h();
  if (!t.lastLibraryFolder || !await _(t.lastLibraryFolder))
    throw new Error("Önce bir kütüphane klasörü seçmelisin.");
  const e = await g.showOpenDialog({
    title: "Kütüphane dosyasını içe aktar",
    filters: [{ name: "Melodify Kütüphane", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (e.canceled || e.filePaths.length === 0)
    return { canceled: !0, total: 0, found: 0, missing: [] };
  const s = await m.readFile(e.filePaths[0], "utf8"), n = JSON.parse(s);
  if (!n.version || !Array.isArray(n.tracks))
    throw new Error("Geçersiz kütüphane dosyası formatı.");
  const i = await x(t.lastLibraryFolder), a = new Set(i.map((o) => o.fileName.toLowerCase())), l = new Set(
    i.map((o) => V(o.fileName)).filter((o) => o !== null)
  ), u = [];
  let d = 0;
  for (const o of n.tracks) {
    const w = a.has(o.fileName.toLowerCase()), F = o.youtubeId ? l.has(o.youtubeId) : !1;
    w || F ? d++ : u.push(o);
  }
  return { canceled: !1, total: n.tracks.length, found: d, missing: u };
}
async function mt(t, e, s = !1) {
  const n = await h();
  if (!n.lastLibraryFolder)
    throw new Error("Kütüphane klasörü bulunamadı.");
  const i = n.lastLibraryFolder;
  let a = 0, l = 0;
  const u = [];
  for (let d = 0; d < t.length; d++) {
    const o = t[d], w = !!(o.webpageUrl || o.youtubeId);
    if (!w && !s) {
      l++, u.push(`${o.title}: İndirme bağlantısı bulunamadı (ad araması onaylanmadı).`), r == null || r.webContents.send("import:progress", {
        current: d + 1,
        total: t.length,
        currentTrack: o.title,
        status: "failed",
        error: "İndirme bağlantısı bulunamadı."
      });
      continue;
    }
    const F = w ? o.webpageUrl ?? `https://www.youtube.com/watch?v=${o.youtubeId}` : `ytsearch1:${o.title}`, W = w ? o.title : `${o.title} (Ad araması)`, k = {
      current: d + 1,
      total: t.length,
      currentTrack: W,
      status: "downloading"
    };
    r == null || r.webContents.send("import:progress", k);
    try {
      await A({
        webpageUrl: F,
        downloadFolderPath: i,
        cookiesFromBrowser: e ?? null
      }), a++, r == null || r.webContents.send("import:progress", {
        ...k,
        status: "completed"
      });
    } catch (T) {
      l++;
      const M = T instanceof Error ? T.message : "Bilinmeyen hata";
      u.push(`${o.title}: ${M}`), r == null || r.webContents.send("import:progress", {
        ...k,
        status: "failed",
        error: M
      });
    }
  }
  return { downloaded: a, failed: l, errors: u };
}
async function ft(t) {
  try {
    const e = await m.readFile(t);
    return {
      fileName: c.basename(t),
      mimeType: tt(t),
      data: e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength)
    };
  } catch {
    return null;
  }
}
function I() {
  r = new N({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#0b1018",
    icon: B(G),
    webPreferences: {
      contextIsolation: !0,
      nodeIntegration: !1,
      preload: c.join(C, "preload.mjs")
    }
  }), v ? r.loadURL(v) : r.loadFile(c.join(R, "index.html")), U({ isPlaying: !1 }), r.on("closed", () => {
    r = null;
  });
}
f.on("second-instance", () => {
  if (r) {
    r.isMinimized() && r.restore(), r.focus();
    return;
  }
  I();
});
function ht() {
  p.handle("library:pick-folder", async () => lt()), p.handle("library:load-last", async () => it()), p.handle("library:load-last-download-folder", async () => st()), p.handle("library:pick-download-folder", async () => ct()), p.handle("library:load-track-payload", async (t, e) => ft(e)), p.handle("library:export", async () => dt()), p.handle("library:import-analyze", async () => pt()), p.handle(
    "library:import-download",
    async (t, e, s, n) => mt(e, s, !!n)
  ), p.handle("yt-dlp:search", async (t, e) => ut(e)), p.handle("yt-dlp:update", async () => rt()), p.on("media:state", (t, e) => {
    U(e);
  }), p.handle("yt-dlp:download", async (t, e) => (await E({
    lastDownloadFolder: D(e.downloadFolderPath)
  }), A(e)));
}
$ && f.whenReady().then(() => {
  process.platform === "win32" && f.setAppUserModelId("com.yhcanbay.melodify"), ht(), I();
});
f.on("window-all-closed", () => {
  process.platform !== "darwin" && (f.quit(), r = null);
});
f.on("activate", () => {
  N.getAllWindows().length === 0 && I();
});
export {
  Ft as MAIN_DIST,
  R as RENDERER_DIST,
  v as VITE_DEV_SERVER_URL
};
