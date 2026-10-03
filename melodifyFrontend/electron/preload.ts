import { ipcRenderer, contextBridge } from 'electron'
import type {
  DownloadRequest,
  DownloadResult,
  LibrarySnapshot,
  MediaCommand,
  MediaControlState,
  PickFolderResult,
  PickLibraryResult,
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
})
