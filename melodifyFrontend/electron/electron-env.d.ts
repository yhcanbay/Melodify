/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  melodifyApi: {
    pickLibrary: () => Promise<
      | {
          canceled: true
        }
      | {
          canceled: false
          snapshot: import('../src/shared/melodify').LibrarySnapshot
        }
    >
    loadLastLibrary: () => Promise<import('../src/shared/melodify').LibrarySnapshot | null>
    loadLastDownloadFolder: () => Promise<string | null>
    pickDownloadFolder: () => Promise<import('../src/shared/melodify').PickFolderResult>
    searchTracks: (
      request: import('../src/shared/melodify').SearchRequest,
    ) => Promise<import('../src/shared/melodify').SearchResult[]>
    updateYtDlp: () => Promise<import('../src/shared/melodify').YtDlpUpdateResult>
    downloadTrack: (
      request: import('../src/shared/melodify').DownloadRequest,
    ) => Promise<import('../src/shared/melodify').DownloadResult>
    loadTrackPayload: (
      filePath: string,
    ) => Promise<import('../src/shared/melodify').TrackPayload | null>
    loadTrackCover: (filePath: string) => Promise<string | null>
    loadTracksCovers: (filePaths: string[]) => Promise<Record<string, string | null>>
    loadPlaylists: (folderPath: string) => Promise<import('../src/shared/melodify').Playlist[]>
    savePlaylist: (
      folderPath: string,
      playlist: import('../src/shared/melodify').Playlist,
    ) => Promise<import('../src/shared/melodify').Playlist>
    deletePlaylist: (
      folderPath: string,
      playlistId: string,
    ) => Promise<{ success: boolean }>
    exportLibrary: () => Promise<import('../src/shared/melodify').ExportResult>
    importAnalyze: () => Promise<import('../src/shared/melodify').ImportAnalysis>
    importDownloadMissing: (
      missingTracks: import('../src/shared/melodify').ExportedTrack[],
      cookiesFromBrowser?: string | null,
      allowSearchForMissingUrl?: boolean,
    ) => Promise<import('../src/shared/melodify').ImportResult>
    setMediaControlState: (state: import('../src/shared/melodify').MediaControlState) => void
    onMediaCommand: (
      callback: (command: import('../src/shared/melodify').MediaCommand) => void,
    ) => () => void
    onImportProgress: (
      callback: (progress: import('../src/shared/melodify').ImportProgress) => void,
    ) => () => void
  }
}
