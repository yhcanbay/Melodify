import { spawn } from 'node:child_process'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Dirent, promises as fs } from 'node:fs'
import { parseFile, selectCover } from 'music-metadata'
import { getFfmpegArgs, getNodeRuntimeArg, getYtDlpPath } from './tools'
import { attachTaskbarMediaControls } from './taskbar'
import type {
  DownloadRequest,
  DownloadResult,
  ExportedLibrary,
  ExportedTrack,
  ExportResult,
  ImportAnalysis,
  ImportProgress,
  ImportResult,
  LibrarySnapshot,
  MediaControlState,
  MusicTrack,
  PickFolderResult,
  PickLibraryResult,
  Playlist,
  PlaylistTrack,
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
// The installed app's Start menu shortcut wins when Explorer resolves a group
// icon. Keep development and portable windows out of that installed app group.
const APP_ID = !app.isPackaged
  ? 'com.yhcanbay.melodify.development'
  : process.env.PORTABLE_EXECUTABLE_FILE
    ? 'com.yhcanbay.melodify.portable'
    : 'com.yhcanbay.melodify'
const APP_ICON_FILE_NAME = process.platform === 'win32' ? 'melodify-icon.ico' : 'melodify-icon.png'

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let taskbarMediaControls: ReturnType<typeof attachTaskbarMediaControls> | null = null
const isPrimaryInstance = app.requestSingleInstanceLock()

if (!isPrimaryInstance) {
  app.quit()
}

function getStateFilePath() {
  return path.join(app.getPath('userData'), STATE_FILE_NAME)
}

function getPublicAssetPath(fileName: string) {
  return path.join(process.env.VITE_PUBLIC, fileName)
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
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')

    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })

    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
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

async function runYtDlp(args: string[]) {
  return runCommand(await getYtDlpPath(), ['--ignore-config', '--encoding', 'utf-8', ...args])
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
  const { stdout } = await runYtDlp(['--version'])
  return stdout.trim()
}

async function updateYtDlp(): Promise<YtDlpUpdateResult> {
  const previousVersion = await getYtDlpVersion()
  const { stdout, stderr } = await runYtDlp(['-U'])
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
      if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'melodify-playlists') {
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
      const fileStat = await fs.stat(absolutePath)

      tracks.push({
        id: absolutePath,
        title: path.basename(entry.name, extension),
        fileName: entry.name,
        filePath: absolutePath,
        extension: extension.replace(/^\./, '').toLowerCase(),
        modifiedTimeMs: fileStat.mtimeMs,
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
  const { stdout } = await runYtDlp([
    '--no-js-runtimes',
    '--js-runtimes',
    getNodeRuntimeArg(),
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
    ...getFfmpegArgs(),
    '--no-js-runtimes',
    '--js-runtimes',
    getNodeRuntimeArg(),
    '--no-warnings',
    '--newline',
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '--embed-thumbnail',
    '--convert-thumbnails',
    'jpg',
    '--embed-metadata',
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

  let stdout: string
  try {
    const result = await runYtDlp(args)
    stdout = result.stdout
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('Failed to decrypt with DPAPI')) {
      throw new Error(
        'Seçilen tarayıcı (Brave/Chrome) çerezleri Windows DPAPI ile şifrelendiğinden okunamadı. Lütfen Ayarlar\'dan Çerez kaynağını "Firefox" olarak değiştirin.',
      )
    }
    if (errorMsg.includes('The page needs to be reloaded')) {
      throw new Error(
        'YouTube oturumu yenileme gerektiriyor. Firefox\'ta YouTube\'u açıp bir video oynatmayı deneyin veya çerez kaynağını "Yok" yapın.',
      )
    }
    throw error
  }

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

function extractYouTubeId(fileName: string): string | null {
  const match = fileName.match(/\[([^\]]+)\]\.[^.]+$/)
  return match ? match[1] : null
}

async function exportLibrary(): Promise<ExportResult> {
  const state = await readState()

  if (!state.lastLibraryFolder || !(await pathExists(state.lastLibraryFolder))) {
    throw new Error('Dışa aktarılacak bir kütüphane klasörü bulunamadı.')
  }

  const tracks = await collectMusicFiles(state.lastLibraryFolder)

  const exportData: ExportedLibrary = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sourcePlatform: process.platform,
    tracks: tracks.map((track) => {
      const youtubeId = extractYouTubeId(track.fileName)

      return {
        title: track.title,
        fileName: track.fileName,
        extension: track.extension,
        youtubeId,
        webpageUrl: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null,
      }
    }),
  }

  const saveResult = await dialog.showSaveDialog({
    title: 'Kütüphaneyi dışa aktar',
    defaultPath: path.join(state.lastLibraryFolder, 'melodify-library.json'),
    filters: [{ name: 'Melodify Kütüphane', extensions: ['json'] }],
  })

  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true }
  }

  await fs.writeFile(saveResult.filePath, JSON.stringify(exportData, null, 2), 'utf8')

  return { canceled: false, filePath: saveResult.filePath, trackCount: exportData.tracks.length }
}

async function analyzeImport(): Promise<ImportAnalysis> {
  const state = await readState()

  if (!state.lastLibraryFolder || !(await pathExists(state.lastLibraryFolder))) {
    throw new Error('Önce bir kütüphane klasörü seçmelisin.')
  }

  const openResult = await dialog.showOpenDialog({
    title: 'Kütüphane dosyasını içe aktar',
    filters: [{ name: 'Melodify Kütüphane', extensions: ['json'] }],
    properties: ['openFile'],
  })

  if (openResult.canceled || openResult.filePaths.length === 0) {
    return { canceled: true, total: 0, found: 0, missing: [] }
  }

  const raw = await fs.readFile(openResult.filePaths[0], 'utf8')
  const data = JSON.parse(raw) as ExportedLibrary

  if (!data.version || !Array.isArray(data.tracks)) {
    throw new Error('Geçersiz kütüphane dosyası formatı.')
  }

  const existingTracks = await collectMusicFiles(state.lastLibraryFolder)
  const existingFileNames = new Set(existingTracks.map((track) => track.fileName.toLowerCase()))
  const existingYouTubeIds = new Set(
    existingTracks
      .map((track) => extractYouTubeId(track.fileName))
      .filter((id): id is string => id !== null),
  )

  const missing: ExportedTrack[] = []
  let found = 0

  for (const track of data.tracks) {
    const fileNameMatch = existingFileNames.has(track.fileName.toLowerCase())
    const idMatch = track.youtubeId ? existingYouTubeIds.has(track.youtubeId) : false

    if (fileNameMatch || idMatch) {
      found++
    } else {
      missing.push(track)
    }
  }

  return { canceled: false, total: data.tracks.length, found, missing }
}

async function downloadMissingTracks(
  missingTracks: ExportedTrack[],
  cookiesFromBrowser?: string | null,
  allowSearchForMissingUrl: boolean = false,
): Promise<ImportResult> {
  const state = await readState()

  if (!state.lastLibraryFolder) {
    throw new Error('Kütüphane klasörü bulunamadı.')
  }

  const downloadFolder = state.lastLibraryFolder
  let downloaded = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < missingTracks.length; i++) {
    const track = missingTracks[i]
    const hasUrl = Boolean(track.webpageUrl || track.youtubeId)

    // Önce URL'e sahip olup olmadığına bakılır
    if (!hasUrl && !allowSearchForMissingUrl) {
      failed++
      errors.push(`${track.title}: İndirme bağlantısı bulunamadı (ad araması onaylanmadı).`)

      win?.webContents.send('import:progress', {
        current: i + 1,
        total: missingTracks.length,
        currentTrack: track.title,
        status: 'failed',
        error: 'İndirme bağlantısı bulunamadı.',
      })
      continue
    }

    // URL varsa doğrudan URL kullanılır; URL yoksa sadece URL'si bulunmayan bu parça için ad araması yapılır
    const targetUrlOrQuery = hasUrl
      ? (track.webpageUrl ?? `https://www.youtube.com/watch?v=${track.youtubeId}`)
      : `ytsearch1:${track.title}`

    const trackLabel = hasUrl ? track.title : `${track.title} (Ad araması)`

    const progress: ImportProgress = {
      current: i + 1,
      total: missingTracks.length,
      currentTrack: trackLabel,
      status: 'downloading',
    }

    win?.webContents.send('import:progress', progress)

    try {
      await downloadWithYtDlp({
        webpageUrl: targetUrlOrQuery,
        downloadFolderPath: downloadFolder,
        cookiesFromBrowser: cookiesFromBrowser ?? null,
      })

      downloaded++

      win?.webContents.send('import:progress', {
        ...progress,
        status: 'completed',
      })
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
      errors.push(`${track.title}: ${message}`)

      win?.webContents.send('import:progress', {
        ...progress,
        status: 'failed',
        error: message,
      })
    }
  }

  return { downloaded, failed, errors }
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

const coverCache = new Map<string, string | null>()
const MAX_COVER_CACHE_ENTRIES = 800

const FOLDER_COVER_FILE_NAMES = [
  'cover.jpg',
  'cover.jpeg',
  'cover.png',
  'cover.webp',
  'folder.jpg',
  'folder.jpeg',
  'folder.png',
  'folder.webp',
  'front.jpg',
  'front.jpeg',
  'front.png',
  'front.webp',
  'album.jpg',
  'album.jpeg',
  'album.png',
  'album.webp',
  'art.jpg',
  'art.jpeg',
  'art.png',
  'art.webp',
]

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

function getImageMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}

async function extractCoverFromAudioOrFolder(filePath: string): Promise<string | null> {
  // 1. Try embedded metadata tags
  try {
    const metadata = await parseFile(filePath, { skipCovers: false })
    const cover = selectCover(metadata.common.picture) ?? metadata.common.picture?.[0]
    if (cover && cover.data && cover.data.length > 0) {
      const mime = cover.format || 'image/jpeg'
      const base64 = Buffer.from(cover.data).toString('base64')
      return `data:${mime};base64,${base64}`
    }
  } catch {
    // If music-metadata fails or file format has no tags, continue to folder check
  }

  // 2. Check same directory image candidates
  try {
    const dir = path.dirname(filePath)
    const baseName = path.basename(filePath, path.extname(filePath))

    for (const ext of IMAGE_EXTENSIONS) {
      const candidatePath = path.join(dir, `${baseName}${ext}`)
      if (await pathExists(candidatePath)) {
        const data = await fs.readFile(candidatePath)
        return `data:${getImageMimeType(candidatePath)};base64,${data.toString('base64')}`
      }
    }

    for (const fileName of FOLDER_COVER_FILE_NAMES) {
      const candidatePath = path.join(dir, fileName)
      if (await pathExists(candidatePath)) {
        const data = await fs.readFile(candidatePath)
        return `data:${getImageMimeType(candidatePath)};base64,${data.toString('base64')}`
      }
    }
  } catch {
    // Ignore folder access errors
  }

  return null
}

async function getTrackCover(filePath: string): Promise<string | null> {
  try {
    const fileStat = await fs.stat(filePath)
    const cacheKey = `${filePath}:${fileStat.mtimeMs}`
    if (coverCache.has(cacheKey)) {
      return coverCache.get(cacheKey) ?? null
    }

    const cover = await extractCoverFromAudioOrFolder(filePath)
    if (coverCache.size >= MAX_COVER_CACHE_ENTRIES) {
      const firstKey = coverCache.keys().next().value
      if (firstKey) coverCache.delete(firstKey)
    }
    coverCache.set(cacheKey, cover)
    return cover
  } catch {
    return null
  }
}

async function getTracksCovers(filePaths: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {}
  await Promise.all(
    filePaths.map(async (filePath) => {
      result[filePath] = await getTrackCover(filePath)
    }),
  )
  return result
}

const PLAYLISTS_DIR_NAME = 'melodify-playlists'
const PLAYLISTS_FILE_NAME = 'melodify-playlists.json'

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'playlist'
}

type RawPlaylistTrack = {
  filePath?: unknown
  relativePath?: unknown
  fileName?: unknown
  title?: unknown
  extension?: unknown
  addedAt?: unknown
}

type RawPlaylistData = {
  id?: unknown
  name?: unknown
  description?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  tracks?: unknown
}

function normalizePlaylist(rawPlaylist: RawPlaylistData, folderPath: string): Playlist {
  const rawTracks: RawPlaylistTrack[] = Array.isArray(rawPlaylist.tracks) ? rawPlaylist.tracks : []
  const tracks: PlaylistTrack[] = rawTracks.map((item) => {
    let resolvedPath = ''
    if (typeof item.filePath === 'string' && item.filePath.trim()) {
      if (path.isAbsolute(item.filePath)) {
        resolvedPath = item.filePath
      } else {
        resolvedPath = path.resolve(folderPath, item.filePath)
      }
    } else if (typeof item.relativePath === 'string' && item.relativePath.trim()) {
      resolvedPath = path.resolve(folderPath, item.relativePath)
    } else if (typeof item.fileName === 'string' && item.fileName.trim()) {
      resolvedPath = path.resolve(folderPath, item.fileName)
    }

    return {
      filePath: resolvedPath,
      fileName: typeof item.fileName === 'string' ? item.fileName : path.basename(resolvedPath),
      title: typeof item.title === 'string' ? item.title : path.basename(resolvedPath, path.extname(resolvedPath)),
      extension:
        typeof item.extension === 'string'
          ? item.extension
          : path.extname(resolvedPath).replace(/^\./, '').toLowerCase(),
      addedAt: typeof item.addedAt === 'string' ? item.addedAt : undefined,
    }
  })

  return {
    id: String(rawPlaylist.id || `pl_${Date.now()}`),
    name: String(rawPlaylist.name || 'Çalma Listesi'),
    description: typeof rawPlaylist.description === 'string' ? rawPlaylist.description : '',
    createdAt: typeof rawPlaylist.createdAt === 'string' ? rawPlaylist.createdAt : new Date().toISOString(),
    updatedAt: typeof rawPlaylist.updatedAt === 'string' ? rawPlaylist.updatedAt : new Date().toISOString(),
    tracks,
  }
}

async function loadPlaylistsFromFolder(folderPath: string): Promise<Playlist[]> {
  if (!folderPath || !(await pathExists(folderPath))) {
    return []
  }

  const playlistsMap = new Map<string, Playlist>()
  const playlistsDir = path.join(folderPath, PLAYLISTS_DIR_NAME)
  const singleFilePath = path.join(folderPath, PLAYLISTS_FILE_NAME)

  // 1. Check if melodify-playlists.json exists
  try {
    if (await pathExists(singleFilePath)) {
      const raw = await fs.readFile(singleFilePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      const parsedObj = parsed as { playlists?: unknown } | null
      const list: RawPlaylistData[] = Array.isArray(parsed)
        ? (parsed as RawPlaylistData[])
        : Array.isArray(parsedObj?.playlists)
          ? (parsedObj?.playlists as RawPlaylistData[])
          : []
      for (const pl of list) {
        if (pl && pl.id && pl.name) {
          playlistsMap.set(String(pl.id), normalizePlaylist(pl, folderPath))
        }
      }
    }
  } catch (error) {
    console.error('melodify-playlists.json okunamadi:', error)
  }

  // 2. Check if melodify-playlists directory exists
  try {
    if (await pathExists(playlistsDir)) {
      const entries = await fs.readdir(playlistsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          try {
            const raw = await fs.readFile(path.join(playlistsDir, entry.name), 'utf8')
            const parsed = JSON.parse(raw)
            if (parsed && parsed.id && parsed.name) {
              playlistsMap.set(parsed.id, normalizePlaylist(parsed, folderPath))
            }
          } catch (fileErr) {
            console.error(`Calma listesi dosyasi okunamadi: ${entry.name}`, fileErr)
          }
        }
      }
    }
  } catch (error) {
    console.error('melodify-playlists klasoru taranamadi:', error)
  }

  const result = Array.from(playlistsMap.values())
  result.sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
    return timeB - timeA
  })

  return result
}

async function savePlaylistToFolder(folderPath: string, playlist: Playlist): Promise<Playlist> {
  if (!folderPath) {
    throw new Error('Kutuphane klasoru belirtilmedi.')
  }

  const playlistsDir = path.join(folderPath, PLAYLISTS_DIR_NAME)
  await fs.mkdir(playlistsDir, { recursive: true })

  const now = new Date().toISOString()
  const cleanId = String(playlist.id || `pl_${Date.now()}`)
  const updatedPlaylist: Playlist = {
    ...playlist,
    id: cleanId,
    createdAt: playlist.createdAt || now,
    updatedAt: now,
    tracks: (playlist.tracks || []).map((t) => {
      let rel = ''
      if (t.filePath && path.isAbsolute(t.filePath)) {
        rel = path.relative(folderPath, t.filePath).replace(/\\/g, '/')
      } else if (t.filePath) {
        rel = t.filePath.replace(/\\/g, '/')
      }
      return {
        ...t,
        filePath: rel || t.fileName,
      }
    }),
  }

  // Remove previous files with this id if name changed
  try {
    const existingFiles = await fs.readdir(playlistsDir)
    for (const f of existingFiles) {
      if (f.endsWith(`${cleanId}.json`) || f === `${cleanId}.json`) {
        await fs.unlink(path.join(playlistsDir, f)).catch(() => {})
      }
    }
  } catch (_error) {
    // Ignore cleanup error
  }

  const safeName = sanitizeFileName(playlist.name || 'playlist')
  const fileName = `${safeName}_${cleanId}.json`
  await fs.writeFile(path.join(playlistsDir, fileName), JSON.stringify(updatedPlaylist, null, 2), 'utf8')

  // Synchronize melodify-playlists.json in folderPath
  try {
    const allPlaylists = await loadPlaylistsFromFolder(folderPath)
    const idx = allPlaylists.findIndex((p) => p.id === cleanId)
    if (idx >= 0) {
      allPlaylists[idx] = updatedPlaylist
    } else {
      allPlaylists.unshift(updatedPlaylist)
    }

    const portableAll = allPlaylists.map((pl) => ({
      ...pl,
      tracks: pl.tracks.map((tr) => ({
        ...tr,
        filePath:
          tr.filePath && path.isAbsolute(tr.filePath)
            ? path.relative(folderPath, tr.filePath).replace(/\\/g, '/')
            : tr.filePath || tr.fileName,
      })),
    }))

    await fs.writeFile(
      path.join(folderPath, PLAYLISTS_FILE_NAME),
      JSON.stringify(portableAll, null, 2),
      'utf8',
    )
  } catch (err) {
    console.error('melodify-playlists.json guncellenemedi:', err)
  }

  return normalizePlaylist(updatedPlaylist, folderPath)
}

async function deletePlaylistFromFolder(folderPath: string, playlistId: string): Promise<{ success: boolean }> {
  if (!folderPath) {
    return { success: false }
  }

  const playlistsDir = path.join(folderPath, PLAYLISTS_DIR_NAME)

  // 1. Delete from directory
  try {
    if (await pathExists(playlistsDir)) {
      const files = await fs.readdir(playlistsDir)
      for (const f of files) {
        if (f.endsWith(`${playlistId}.json`) || f === `${playlistId}.json`) {
          await fs.unlink(path.join(playlistsDir, f)).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.error('Calma listesi dosyasi silinemedi:', err)
  }

  // 2. Update root melodify-playlists.json
  try {
    const singleFilePath = path.join(folderPath, PLAYLISTS_FILE_NAME)
    if (await pathExists(singleFilePath)) {
      const raw = await fs.readFile(singleFilePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      const parsedObj = parsed as { playlists?: unknown } | null
      const list: RawPlaylistData[] = Array.isArray(parsed)
        ? (parsed as RawPlaylistData[])
        : Array.isArray(parsedObj?.playlists)
          ? (parsedObj?.playlists as RawPlaylistData[])
          : []
      const filtered = list.filter((p) => String(p.id) !== String(playlistId))
      await fs.writeFile(singleFilePath, JSON.stringify(filtered, null, 2), 'utf8')
    }
  } catch (err) {
    console.error('melodify-playlists.json guncellenemedi:', err)
  }

  return { success: true }
}

function createWindow() {
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#101119',
    title: 'Melodify',
    icon: getPublicAssetPath(APP_ICON_FILE_NAME),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })
  win = window

  if (process.platform === 'win32') {
    const executable = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
    window.setAppDetails({
      appId: APP_ID,
      appIconPath: app.isPackaged ? executable : getPublicAssetPath('melodify-icon.ico'),
      appIconIndex: 0,
      relaunchCommand: app.isPackaged ? `"${executable}"` : `"${executable}" "${app.getAppPath()}"`,
      relaunchDisplayName: 'Melodify',
    })
  }
  // Set the complete shell identity before showing the window; otherwise
  // Explorer can cache the host executable's icon for the taskbar group.
  taskbarMediaControls = attachTaskbarMediaControls(window, process.env.VITE_PUBLIC)

  if (VITE_DEV_SERVER_URL) {
    window.loadURL(VITE_DEV_SERVER_URL)
  } else {
    window.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
  window.show()

  window.on('closed', () => {
    taskbarMediaControls = null
    win = null
  })
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
  ipcMain.handle('library:load-track-cover', async (_event, filePath: string) => getTrackCover(filePath))
  ipcMain.handle('library:load-tracks-covers', async (_event, filePaths: string[]) => getTracksCovers(filePaths))
  ipcMain.handle('playlists:load-all', async (_event, folderPath?: string) => {
    const targetFolder = folderPath || (await readState()).lastLibraryFolder
    if (!targetFolder) return []
    return loadPlaylistsFromFolder(targetFolder)
  })
  ipcMain.handle('playlists:save', async (_event, folderPath: string, playlist: Playlist) => {
    const targetFolder = folderPath || (await readState()).lastLibraryFolder
    return savePlaylistToFolder(targetFolder!, playlist)
  })
  ipcMain.handle('playlists:delete', async (_event, folderPath: string, playlistId: string) => {
    const targetFolder = folderPath || (await readState()).lastLibraryFolder
    return deletePlaylistFromFolder(targetFolder!, playlistId)
  })
  ipcMain.handle('library:export', async () => exportLibrary())
  ipcMain.handle('library:import-analyze', async () => analyzeImport())
  ipcMain.handle(
    'library:import-download',
    async (
      _event,
      missingTracks: ExportedTrack[],
      cookiesFromBrowser?: string | null,
      allowSearchForMissingUrl?: boolean,
    ) => downloadMissingTracks(missingTracks, cookiesFromBrowser, Boolean(allowSearchForMissingUrl)),
  )
  ipcMain.handle('yt-dlp:search', async (_event, request: SearchRequest) => searchWithYtDlp(request))
  ipcMain.handle('yt-dlp:update', async () => updateYtDlp())
  ipcMain.on('media:state', (event, state: MediaControlState) => {
    if (event.sender !== win?.webContents || !state || typeof state !== 'object') return
    if (typeof state.hasTrack !== 'boolean' || typeof state.isPlaying !== 'boolean') return
    taskbarMediaControls?.update({
      hasTrack: state.hasTrack,
      isPlaying: state.hasTrack && state.isPlaying,
      title: typeof state.title === 'string' ? state.title : undefined,
    })
  })
  ipcMain.handle('yt-dlp:download', async (_event, request: DownloadRequest) => {
    await updateState({
      lastDownloadFolder: normalizeDownloadFolder(request.downloadFolderPath),
    })

    return downloadWithYtDlp(request)
  })
}

if (isPrimaryInstance) {
  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId(APP_ID)
    }

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
