import type { Appearance } from './appearance'
import type { ExportedLibrary, SearchResult } from './melodify'

export const MOBILE_PROTOCOL_VERSION = 1

export type FeatureAvailability = {
  state: 'available' | 'not-implemented' | 'unavailable'
  message: string
}

export type MobileFolder = {
  id: string
  treeUri: string
  name: string
  access: 'granted' | 'revoked' | 'missing' | 'unmounted'
}

// Identity is independent of the Android document provider's URI or file name.
export type MobileTrack = {
  id: string
  libraryId: string
  contentUri: string
  fileName: string
  relativePath: string
  title: string
  artist: string | null
  durationMs: number | null
  youtubeId: string | null
  access: 'available' | 'missing'
  modifiedTimeMs: number
  sizeBytes: number
}

export type MobileLibrarySnapshot = {
  availability: FeatureAvailability
  folder: MobileFolder | null
  tracks: MobileTrack[]
  scanning: boolean
  error: string | null
}

export type MobileRepeatMode = 'off' | 'once' | 'one'

export type MobilePlaybackSnapshot = {
  availability: FeatureAvailability
  queue: MobileTrack[]
  currentTrackId: string | null
  isPlaying: boolean
  positionMs: number
  durationMs: number
  repeat: MobileRepeatMode
  shuffle: boolean
  volume: number
  error: string | null
  restoring: boolean
  repeatPass: 0 | 1
}

export type MobileDownloadJob = {
  id: string
  sourceUrl: string
  targetFolderId: string
  title: string
  stage: 'queued' | 'preparing' | 'downloading' | 'converting' | 'saving' | 'canceling' | 'completed' | 'failed' | 'canceled' | 'interrupted'
  progress: number | null
  error: string | null
  outputUri: string | null
  validation: MobileDownloadValidation | null
}

export type MobileDownloadValidation = {
  title: string
  artist: string
  durationMs: number
  hasEmbeddedJpeg: boolean
  audioCodec: 'mp3'
  sha256: string
}

export type MobileDownloadsSnapshot = {
  availability: FeatureAvailability
  engineReady: boolean
  persistenceError: string | null
  jobs: MobileDownloadJob[]
  search: {
    query: string
    state: 'idle' | 'searching' | 'completed' | 'canceled' | 'failed'
    error: string | null
    results: SearchResult[]
  }
  probePlayback: {
    jobId: string | null
    isPlaying: boolean
    positionMs: number
    durationMs: number
    error: string | null
  }
}

export type MobilePlaylist = {
  id: string
  libraryId: string
  name: string
  description: string
  trackIds: string[]
  createdAt: string
  updatedAt: string
}

export type MobilePlaylistsSnapshot = {
  availability: FeatureAvailability
  playlists: MobilePlaylist[]
}

export type MobileTool = {
  name: 'python' | 'yt-dlp' | 'ffmpeg' | 'ffprobe' | 'quickjs'
  version: string | null
  sha256: string | null
  ready: boolean
}

export type MobileSettingsSnapshot = {
  availability: FeatureAvailability
  protocolVersion: number
  platform: 'android' | 'web'
  appVersion: string
  androidApi: number | null
  supportedAbis: string[]
  downloadFolder: MobileFolder | null
  cookiesImported: boolean
  tools: MobileTool[]
  toolStatus: 'not-prepared' | 'preparing' | 'ready' | 'failed'
  toolError: string | null
}

export type MobileSnapshot = {
  library: MobileLibrarySnapshot
  playback: MobilePlaybackSnapshot
  downloads: MobileDownloadsSnapshot
  playlists: MobilePlaylistsSnapshot
  settings: MobileSettingsSnapshot
}

export type FolderSelection = { canceled: true } | { canceled: false; folder: MobileFolder }

export type MobilePlaybackCommand =
  | { type: 'loadQueue'; tracks: MobileTrack[]; startTrackId: string }
  | { type: 'play' | 'pause' | 'previous' | 'next' }
  | { type: 'seek'; positionMs: number }
  | { type: 'selectTrack'; trackId: string }
  | { type: 'setVolume'; volume: number }
  | { type: 'reorder'; trackIds: string[] }
  | { type: 'setRepeat'; mode: MobileRepeatMode }
  | { type: 'setShuffle'; enabled: boolean }

export type MobilePlaylistCommand =
  | { type: 'create'; libraryId: string; name: string; description: string }
  | { type: 'update'; playlistId: string; name: string; description: string }
  | { type: 'delete'; playlistId: string }
  | { type: 'addTrack' | 'removeTrack'; playlistId: string; trackId: string }
  | { type: 'reorder'; playlistId: string; trackIds: string[] }

export type MobileTransferResult = { canceled: true } | { canceled: false; trackCount: number }

// Desktop transfer schema remains unchanged; mobile identity never becomes a Windows path.
export type MobileImportRequest = { library: ExportedLibrary; searchMissingByTitle: boolean }

export type MobileSearchRequest = { query: string; limit?: number }
export type MobileSearchResponse = { results: SearchResult[] }
export type MobileAppearance = Appearance
