export type MusicTrack = {
  id: string
  title: string
  fileName: string
  filePath: string
  extension: string
  modifiedTimeMs: number
}

export type LibrarySnapshot = {
  folderPath: string
  tracks: MusicTrack[]
}

export type SearchResult = {
  id: string
  title: string
  uploader: string
  durationText: string
  webpageUrl: string
  thumbnailUrl: string
}

export type PickLibraryResult =
  | {
      canceled: true
    }
  | {
      canceled: false
      snapshot: LibrarySnapshot
    }

export type PickFolderResult =
  | {
      canceled: true
    }
  | {
      canceled: false
      folderPath: string
    }

export type SearchRequest = {
  query: string
  limit?: number
}

export type DownloadRequest = {
  webpageUrl: string
  downloadFolderPath: string
  cookiesFromBrowser?: string | null
}

export type DownloadResult = {
  fileName: string
  outputPath: string
}

export type YtDlpUpdateResult = {
  previousVersion: string
  currentVersion: string
  updated: boolean
  output: string
}

export type TrackPayload = {
  fileName: string
  mimeType: string
  data: ArrayBuffer
}

export type MediaCommand = 'play-pause' | 'previous' | 'next'

export type MediaControlState = {
  hasTrack: boolean
  isPlaying: boolean
  title?: string
}

export type ExportedTrack = {
  title: string
  fileName: string
  extension: string
  youtubeId: string | null
  webpageUrl: string | null
}

export type ExportedLibrary = {
  version: string
  exportedAt: string
  sourcePlatform: string
  tracks: ExportedTrack[]
}

export type ExportResult =
  | { canceled: true }
  | { canceled: false; filePath: string; trackCount: number }

export type ImportAnalysis = {
  canceled: boolean
  total: number
  found: number
  missing: ExportedTrack[]
}

export type ImportProgress = {
  current: number
  total: number
  currentTrack: string
  status: 'downloading' | 'completed' | 'failed'
  error?: string
}

export type ImportResult = {
  downloaded: number
  failed: number
  errors: string[]
}

export type PlaylistTrack = {
  filePath: string
  fileName: string
  title: string
  extension?: string
  addedAt?: string
}

export type Playlist = {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  tracks: PlaylistTrack[]
}
