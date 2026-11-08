import { MOBILE_PROTOCOL_VERSION } from '../../../src/shared/mobile.ts'
import type { FeatureAvailability, MobileSnapshot } from '../../../src/shared/mobile.ts'

export function createPreviewSnapshot(): MobileSnapshot {
  const availability = (): FeatureAvailability => ({
    state: 'unavailable',
    message: 'Bu özellik Android uygulamasında kullanılabilir. Tarayıcı önizlemesi cihaz dosyalarına erişmez.',
  })
  return {
    library: { availability: availability(), folder: null, tracks: [], scanning: false, error: null },
    playback: {
      availability: availability(), queue: [], currentTrackId: null, isPlaying: false,
      positionMs: 0, durationMs: 0, repeat: 'off', shuffle: false,
      volume: 1, error: null, restoring: false, repeatPass: 0,
    },
    downloads: {
      availability: availability(), jobs: [], engineReady: false, persistenceError: null,
      search: { query: '', state: 'idle', error: null, results: [] },
      probePlayback: { jobId: null, isPlaying: false, positionMs: 0, durationMs: 0, error: null },
    },
    playlists: { availability: availability(), playlists: [] },
    settings: {
      availability: availability(), protocolVersion: MOBILE_PROTOCOL_VERSION, platform: 'web',
      appVersion: '1.0.1', androidApi: null, supportedAbis: [], downloadFolder: null,
      cookiesImported: false,
      toolStatus: 'not-prepared', toolError: null,
      tools: ['python', 'yt-dlp', 'ffmpeg', 'ffprobe', 'quickjs'].map((name) => ({
        name: name as MobileSnapshot['settings']['tools'][number]['name'],
        version: null, sha256: null, ready: false,
      })),
    },
  }
}
