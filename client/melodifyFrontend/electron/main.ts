import { spawn } from 'node:child_process'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Dirent, promises as fs } from 'node:fs'
import type {
  DownloadRequest,
  DownloadResult,
  LibrarySnapshot,
  MusicTrack,
  PickFolderResult,
  PickLibraryResult,
  SearchRequest,
  SearchResult,
  TrackPayload,
  YtDlpUpdateResult,
} from '../src/shared/melodify'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SUPPORTED_EXTENSIONS = new Set([
  '.aac',
  '.flac',
  '.m4a',
  '.m4b',
  '.mp3',
  '.ogg',
  '.oga',
  '.opus',
  '.wav',
  '.webm',
])

const MIME_BY_EXTENSION: Record<string, string> = {
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
}

type AppState = {
  lastLibraryFolder?: string
  lastDownloadFolder?: string
}

const SUPPORTED_COOKIE_BROWSERS = new Set(['chrome', 'chromium', 'edge', 'firefox', 'brave', 'opera'])

const STATE_FILE_NAME = 'melodify-state.json'

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const isPrimaryInstance = app.requestSingleInstanceLock()

if (!isPrimaryInstance) {
  app.quit()
}

function getStateFilePath() {
  return path.join(app.getPath('userData'), STATE_FILE_NAME)
}

async function readState(): Promise<AppState> {
  try {
    const raw = await fs.readFile(getStateFilePath(), 'utf8')
    const parsed = JSON.parse(raw) as AppState

    return {
      lastLibraryFolder: typeof parsed.lastLibraryFolder === 'string' ? parsed.lastLibraryFolder : undefined,
      lastDownloadFolder: typeof parsed.lastDownloadFolder === 'string' ? parsed.lastDownloadFolder : undefined,
    }
  } catch {
    return {}
  }
}

async function writeState(nextState: AppState) {
  await fs.mkdir(path.dirname(getStateFilePath()), { recursive: true })
  await fs.writeFile(getStateFilePath(), JSON.stringify(nextState, null, 2), 'utf8')
}

async function updateState(patch: Partial<AppState>) {
  const currentState = await readState()
  await writeState({ ...currentState, ...patch })
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function isSupportedMusicFile(fileName: string) {
  return SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

function getMimeType(filePath: string) {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || Number.isNaN(seconds)) {
    return 'Bilinmiyor'
  }

  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function normalizeDownloadFolder(folderPath: string) {
  return path.resolve(folderPath)
}

function normalizeCookieBrowser(browserName?: string | null) {
  const value = browserName?.trim().toLowerCase()

  if (!value) {
    return null
  }

  return SUPPORTED_COOKIE_BROWSERS.has(value) ? value : null
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(new Error(stderr.trim() || `Komut hata ile sonlandi. Kod: ${code ?? 'bilinmiyor'}`))
    })
  })
}

function getYouTubeWatchUrl(videoIdOrUrl: string) {
  if (videoIdOrUrl.startsWith('http://') || videoIdOrUrl.startsWith('https://')) {
    return videoIdOrUrl
  }

  return `https://www.youtube.com/watch?v=${videoIdOrUrl}`
}

function formatCommandOutput(stdout: string, stderr: string) {
  return [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
}

async function getYtDlpVersion() {
  const { stdout } = await runCommand('yt-dlp', ['--version'])
  return stdout.trim()
}

async function updateYtDlp(): Promise<YtDlpUpdateResult> {
  const previousVersion = await getYtDlpVersion()
  const { stdout, stderr } = await runCommand('yt-dlp', ['-U'])
  const currentVersion = await getYtDlpVersion()

  return {
    previousVersion,
    currentVersion,
    updated: previousVersion !== currentVersion,
    output: formatCommandOutput(stdout, stderr),
  }
}

async function collectMusicFiles(rootFolder: string): Promise<MusicTrack[]> {
  const tracks: MusicTrack[] = []

  async function visitDirectory(folderPath: string) {
    let entries: Dirent[]

    try {
      entries = await fs.readdir(folderPath, { withFileTypes: true })
    } catch {
      return
    }

    entries.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue
      }

      const absolutePath = path.join(folderPath, entry.name)

      if (entry.isSymbolicLink()) {
        continue
      }

      if (entry.isDirectory()) {
        await visitDirectory(absolutePath)
        continue
      }

      if (!entry.isFile() || !isSupportedMusicFile(entry.name)) {
        continue
      }

      const extension = path.extname(entry.name)

      tracks.push({
        id: absolutePath,
        title: path.basename(entry.name, extension),
        fileName: entry.name,
        filePath: absolutePath,
        extension: extension.replace(/^\./, '').toLowerCase(),
      })
    }
  }

  await visitDirectory(rootFolder)

  tracks.sort((left, right) =>
    left.filePath.localeCompare(right.filePath, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  )

  return tracks
}

async function buildLibrarySnapshot(folderPath: string): Promise<LibrarySnapshot> {
  return {
    folderPath,
    tracks: await collectMusicFiles(folderPath),
  }
}

async function loadLastLibrarySnapshot(): Promise<LibrarySnapshot | null> {
  const state = await readState()

  if (!state.lastLibraryFolder) {
    return null
  }

  if (!(await pathExists(state.lastLibraryFolder))) {
    return null
  }

  return buildLibrarySnapshot(state.lastLibraryFolder)
}

async function loadLastDownloadFolder(): Promise<string | null> {
  const state = await readState()
  return state.lastDownloadFolder ?? null
}

async function pickMusicFolder(): Promise<PickLibraryResult> {
  const result = await dialog.showOpenDialog({
    title: 'Müzik klasörü seç',
    properties: ['openDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  const folderPath = result.filePaths[0]
  const snapshot = await buildLibrarySnapshot(folderPath)

  await updateState({ lastLibraryFolder: folderPath })

  return {
    canceled: false,
    snapshot,
  }
}

async function pickDownloadFolder(): Promise<PickFolderResult> {
  const result = await dialog.showOpenDialog({
    title: 'İndirme klasörü seç',
    properties: ['openDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  const folderPath = normalizeDownloadFolder(result.filePaths[0])
  await updateState({ lastDownloadFolder: folderPath })

  return {
    canceled: false,
    folderPath,
  }
}

async function searchWithYtDlp(request: SearchRequest): Promise<SearchResult[]> {
  const query = request.query.trim()

  if (!query) {
    return []
  }

  const limit = Math.max(1, Math.min(20, request.limit ?? 10))
  const { stdout } = await runCommand('yt-dlp', [
    '--flat-playlist',
    '--dump-single-json',
    '--no-warnings',
    `ytsearch${limit}:${query}`,
  ])

  const parsed = JSON.parse(stdout) as {
    entries?: Array<{
      id?: string
      title?: string
      uploader?: string
      channel?: string
      duration?: number
      webpage_url?: string
      url?: string
      thumbnail?: string
      thumbnails?: Array<{ url?: string }>
    }>
  }

  return (parsed.entries ?? [])
    .filter((entry) => Boolean(entry.id || entry.url || entry.webpage_url))
    .map((entry, index) => {
      const idOrUrl = entry.id ?? entry.url ?? `${index}`

      return {
        id: idOrUrl,
        title: entry.title ?? 'Başlıksız sonuç',
        uploader: entry.uploader ?? entry.channel ?? 'Bilinmiyor',
        durationText: formatDuration(entry.duration),
        webpageUrl: entry.webpage_url ?? getYouTubeWatchUrl(idOrUrl),
        thumbnailUrl: entry.thumbnail ?? entry.thumbnails?.[0]?.url ?? '',
      }
    })
}

async function downloadWithYtDlp(request: DownloadRequest): Promise<DownloadResult> {
  const downloadFolderPath = normalizeDownloadFolder(request.downloadFolderPath)
  const cookiesBrowser = normalizeCookieBrowser(request.cookiesFromBrowser)
  await fs.mkdir(downloadFolderPath, { recursive: true })

  const args = [
    '--no-warnings',
    '--newline',
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '--restrict-filenames',
    '--paths',
    `home:${downloadFolderPath}`,
    '--output',
    '%(title)s [%(id)s].%(ext)s',
    '--print',
    'after_move:filepath',
  ]

  if (cookiesBrowser) {
    args.push('--cookies-from-browser', cookiesBrowser)
  }

  args.push(request.webpageUrl)

  const { stdout } = await runCommand('yt-dlp', args)

  const outputLines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const lastOutputLine = outputLines[outputLines.length - 1]

  if (!lastOutputLine) {
    throw new Error('Yukleme tamamlandi ama cikis dosyasi bulunamadi.')
  }

  return {
    fileName: path.basename(lastOutputLine),
    outputPath: lastOutputLine,
  }
}

async function loadTrackPayload(filePath: string): Promise<TrackPayload | null> {
  try {
    const data = await fs.readFile(filePath)

    return {
      fileName: path.basename(filePath),
      mimeType: getMimeType(filePath),
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    }
  } catch {
    return null
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0b1018',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) {
      win.restore()
    }

    win.focus()
    return
  }

  createWindow()
})

function registerIpcHandlers() {
  ipcMain.handle('library:pick-folder', async () => pickMusicFolder())
  ipcMain.handle('library:load-last', async () => loadLastLibrarySnapshot())
  ipcMain.handle('library:load-last-download-folder', async () => loadLastDownloadFolder())
  ipcMain.handle('library:pick-download-folder', async () => pickDownloadFolder())
  ipcMain.handle('library:load-track-payload', async (_event, filePath: string) => loadTrackPayload(filePath))
  ipcMain.handle('yt-dlp:search', async (_event, request: SearchRequest) => searchWithYtDlp(request))
  ipcMain.handle('yt-dlp:update', async () => updateYtDlp())
  ipcMain.handle('yt-dlp:download', async (_event, request: DownloadRequest) => {
    await updateState({
      lastDownloadFolder: normalizeDownloadFolder(request.downloadFolderPath),
    })

    return downloadWithYtDlp(request)
  })
}

if (isPrimaryInstance) {
  app.whenReady().then(() => {
    registerIpcHandlers()
    createWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
