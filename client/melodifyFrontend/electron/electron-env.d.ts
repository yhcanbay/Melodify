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
  }
}
