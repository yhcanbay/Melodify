import type { PluginListenerHandle } from '@capacitor/core'
import type {
  FolderSelection,
  MobileDownloadsSnapshot,
  MobileImportRequest,
  MobileLibrarySnapshot,
  MobilePlaybackCommand,
  MobilePlaybackSnapshot,
  MobilePlaylistCommand,
  MobilePlaylistsSnapshot,
  MobileSearchRequest,
  MobileSearchResponse,
  MobileSettingsSnapshot,
  MobileSnapshot,
  MobileTransferResult,
} from '../../../src/shared/mobile'

export type Unsubscribe = () => void

export interface LibraryBridge {
  getSnapshot(): Promise<MobileLibrarySnapshot>
  pickFolder(): Promise<FolderSelection>
  scan(): Promise<MobileLibrarySnapshot>
  getCover(options: { trackId: string }): Promise<{ uri: string | null }>
  addListener(event: 'snapshotChanged', listener: () => void): Promise<PluginListenerHandle>
}

export interface PlaybackBridge {
  getSnapshot(): Promise<MobilePlaybackSnapshot>
  dispatch(command: MobilePlaybackCommand): Promise<void>
  addListener(event: 'snapshotChanged', listener: () => void): Promise<PluginListenerHandle>
}

export interface DownloadsBridge {
  getSnapshot(): Promise<MobileDownloadsSnapshot>
  search(options: MobileSearchRequest): Promise<MobileSearchResponse>
  enqueue(options: { sourceUrl: string; targetFolderId: string }): Promise<{ jobId: string }>
  cancel(options: { jobId: string }): Promise<void>
  cancelSearch(): Promise<void>
  playProbe(options: { jobId: string }): Promise<void>
  pauseProbe(): Promise<void>
  retry(options: { jobId: string }): Promise<void>
  addListener(event: 'snapshotChanged', listener: () => void): Promise<PluginListenerHandle>
}

export interface PlaylistsBridge {
  getSnapshot(): Promise<MobilePlaylistsSnapshot>
  dispatch(command: MobilePlaylistCommand): Promise<void>
}

export interface SettingsBridge {
  getSnapshot(): Promise<MobileSettingsSnapshot>
  pickDownloadFolder(): Promise<FolderSelection>
  importCookies(): Promise<{ canceled: boolean }>
  deleteCookies(): Promise<void>
  updateTools(): Promise<void>
  initializeTools(): Promise<void>
  exportLibrary(): Promise<MobileTransferResult>
  importLibrary(options: MobileImportRequest): Promise<MobileTransferResult>
  setBackNavigation(options: { enabled: boolean }): Promise<void>
  addListener(event: 'foreground' | 'backRequested' | 'snapshotChanged', listener: () => void): Promise<PluginListenerHandle>
}

export interface MobilePlatform {
  readonly kind: 'android' | 'web'
  library: LibraryBridge
  playback: PlaybackBridge
  downloads: DownloadsBridge
  playlists: PlaylistsBridge
  settings: SettingsBridge
  readSnapshot(): Promise<MobileSnapshot>
  subscribe(listener: () => void, onError: (error: unknown) => void): Unsubscribe
}
