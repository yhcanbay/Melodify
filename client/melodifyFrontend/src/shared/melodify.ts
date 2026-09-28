export type MusicTrack = {
  id: string
  title: string
  fileName: string
  filePath: string
  extension: string
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

export type TrackPayload = {
  fileName: string
  mimeType: string
  data: ArrayBuffer
}
