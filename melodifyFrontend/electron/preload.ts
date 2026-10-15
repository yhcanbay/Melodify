import { ipcRenderer, contextBridge } from 'electron'
import type {
  DownloadRequest,
  DownloadResult,
  ExportedTrack,
  ExportResult,
  ImportAnalysis,
  ImportProgress,
  ImportResult,
  LibrarySnapshot,
  MediaCommand,
  MediaControlState,
  PickFolderResult,
  PickLibraryResult,
  Playlist,
  SearchRequest,
  SearchResult,
  TrackPayload,
  YtDlpUpdateResult,
} from '../src/shared/melodify'

contextBridge.exposeInMainWorld('melodifyApi', {
  pickLibrary: () => ipcRenderer.invoke('library:pick-folder') as Promise<PickLibraryResult>,
  loadLastLibrary: () =>
    ipcRenderer.invoke('library:load-last') as Promise<LibrarySnapshot | null>,
  loadLastDownloadFolder: () => ipcRenderer.invoke('library:load-last-download-folder') as Promise<string | null>,
  pickDownloadFolder: () => ipcRenderer.invoke('library:pick-download-folder') as Promise<PickFolderResult>,
  searchTracks: (request: SearchRequest) =>
    ipcRenderer.invoke('yt-dlp:search', request) as Promise<SearchResult[]>,
  updateYtDlp: () => ipcRenderer.invoke('yt-dlp:update') as Promise<YtDlpUpdateResult>,
  downloadTrack: (request: DownloadRequest) =>
    ipcRenderer.invoke('yt-dlp:download', request) as Promise<DownloadResult>,
  loadTrackPayload: (filePath: string) =>
    ipcRenderer.invoke('library:load-track-payload', filePath) as Promise<TrackPayload | null>,
  loadTrackCover: (filePath: string) =>
    ipcRenderer.invoke('library:load-track-cover', filePath) as Promise<string | null>,
  loadTracksCovers: (filePaths: string[]) =>
    ipcRenderer.invoke('library:load-tracks-covers', filePaths) as Promise<Record<string, string | null>>,
  loadPlaylists: (folderPath: string) =>
    ipcRenderer.invoke('playlists:load-all', folderPath) as Promise<Playlist[]>,
  savePlaylist: (folderPath: string, playlist: Playlist) =>
    ipcRenderer.invoke('playlists:save', folderPath, playlist) as Promise<Playlist>,
  deletePlaylist: (folderPath: string, playlistId: string) =>
    ipcRenderer.invoke('playlists:delete', folderPath, playlistId) as Promise<{ success: boolean }>,
  exportLibrary: () => ipcRenderer.invoke('library:export') as Promise<ExportResult>,
  importAnalyze: () => ipcRenderer.invoke('library:import-analyze') as Promise<ImportAnalysis>,
  importDownloadMissing: (
    missingTracks: ExportedTrack[],
    cookiesFromBrowser?: string | null,
    allowSearchForMissingUrl?: boolean,
  ) =>
    ipcRenderer.invoke(
      'library:import-download',
      missingTracks,
      cookiesFromBrowser,
      allowSearchForMissingUrl,
    ) as Promise<ImportResult>,
  setMediaControlState: (state: MediaControlState) => ipcRenderer.send('media:state', state),
  onMediaCommand: (callback: (command: MediaCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: MediaCommand) => {
      callback(command)
    }

    ipcRenderer.on('media:command', listener)

    return () => {
      ipcRenderer.removeListener('media:command', listener)
    }
  },
  onImportProgress: (callback: (progress: ImportProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ImportProgress) => {
      callback(progress)
    }

    ipcRenderer.on('import:progress', listener)

    return () => {
      ipcRenderer.removeListener('import:progress', listener)
    }
  },
})

