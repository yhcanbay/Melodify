import type { MobilePlatform } from './contracts'
import { MobilePlatformError } from './errors'
import { createPreviewSnapshot } from './initialSnapshot'

async function unavailable(): Promise<never> {
  throw new MobilePlatformError('ANDROID_REQUIRED', 'Bu işlem için Melodify Android uygulamasını kullanın.')
}

const addListener = async () => ({ remove: async () => {} })

export function createWebPlatform(): MobilePlatform {
  return {
    kind: 'web',
    library: {
      getSnapshot: async () => createPreviewSnapshot().library,
      pickFolder: unavailable, scan: unavailable, getCover: unavailable, addListener,
    },
    playback: { getSnapshot: async () => createPreviewSnapshot().playback, dispatch: unavailable, addListener },
    downloads: {
      getSnapshot: async () => createPreviewSnapshot().downloads,
      search: unavailable, enqueue: unavailable, cancel: unavailable, cancelSearch: unavailable,
      playProbe: unavailable, pauseProbe: unavailable, retry: unavailable, addListener,
    },
    playlists: { getSnapshot: async () => createPreviewSnapshot().playlists, dispatch: unavailable },
    settings: {
      getSnapshot: async () => createPreviewSnapshot().settings,
      pickDownloadFolder: unavailable, importCookies: unavailable, deleteCookies: unavailable,
      updateTools: unavailable, initializeTools: unavailable, exportLibrary: unavailable, importLibrary: unavailable,
      setBackNavigation: async () => {}, addListener,
    },
    readSnapshot: async () => createPreviewSnapshot(),
    subscribe: () => () => {},
  }
}
