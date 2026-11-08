import { registerPlugin } from '@capacitor/core'
import { MOBILE_PROTOCOL_VERSION } from '../../../src/shared/mobile'
import type { MobileSnapshot } from '../../../src/shared/mobile'
import type { DownloadsBridge, LibraryBridge, MobilePlatform, PlaybackBridge, PlaylistsBridge, SettingsBridge } from './contracts'
import { MobilePlatformError } from './errors'
import { manageSubscriptions } from './subscriptions'
import { assertMobileSnapshot } from './validateSnapshot'

const library = registerPlugin<LibraryBridge>('MelodifyLibrary')
const playback = registerPlugin<PlaybackBridge>('MelodifyPlayback')
const downloads = registerPlugin<DownloadsBridge>('MelodifyDownloads')
const playlists = registerPlugin<PlaylistsBridge>('MelodifyPlaylists')
const settings = registerPlugin<SettingsBridge>('MelodifySettings')

export function createAndroidPlatform(): MobilePlatform {
  return {
    kind: 'android', library, playback, downloads, playlists, settings,
    async readSnapshot(): Promise<MobileSnapshot> {
      const currentSettings = await settings.getSnapshot()
      if (currentSettings.protocolVersion !== MOBILE_PROTOCOL_VERSION || currentSettings.platform !== 'android') {
        throw new MobilePlatformError('BRIDGE_VERSION_MISMATCH', 'Uygulama bileşenleri uyumsuz. Melodify güncellemesini yeniden yükleyin.')
      }
      const [currentLibrary, currentPlayback, currentDownloads, currentPlaylists] = await Promise.all([
        library.getSnapshot(), playback.getSnapshot(), downloads.getSnapshot(), playlists.getSnapshot(),
      ])
      const snapshot = { settings: currentSettings, library: currentLibrary, playback: currentPlayback, downloads: currentDownloads, playlists: currentPlaylists }
      assertMobileSnapshot(snapshot)
      return snapshot
    },
    subscribe(listener, onError) {
      return manageSubscriptions([
        library.addListener('snapshotChanged', listener),
        settings.addListener('foreground', listener),
        settings.addListener('snapshotChanged', listener),
        playback.addListener('snapshotChanged', listener),
        downloads.addListener('snapshotChanged', listener),
      ], onError)
    },
  }
}
