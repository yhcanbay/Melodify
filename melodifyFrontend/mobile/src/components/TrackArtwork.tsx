import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import type { MobileTrack } from '../../../src/shared/mobile'
import { mobilePlatform } from '../platform'
import { MobileIcon } from './MobileIcon'

const covers = new Map<string, Promise<string | null>>()

export function TrackArtwork({ track, accessible = true, className = '' }: { track: MobileTrack | undefined; accessible?: boolean; className?: string }) {
  const [cover, setCover] = useState<{ key: string; uri: string } | null>(null)
  const trackId = track?.id
  const contentUri = track?.contentUri
  const access = track?.access
  const modifiedTimeMs = track?.modifiedTimeMs
  const sizeBytes = track?.sizeBytes
  const key = `${trackId}:${contentUri}:${modifiedTimeMs}:${sizeBytes}`
  useEffect(() => {
    let disposed = false
    setCover(null)
    if (trackId && accessible && access === 'available') {
      let request = covers.get(key)
      if (!request) {
        request = mobilePlatform.library.getCover({ trackId }).then(({ uri }) =>
          uri?.startsWith('content://') ? `${Capacitor.convertFileSrc(uri)}?v=${modifiedTimeMs}-${sizeBytes}` : null).catch(() => null)
        covers.set(key, request)
        if (covers.size > 128) covers.delete(covers.keys().next().value!)
      }
      void request.then((uri) => { if (!disposed && uri) setCover({ key, uri }) })
    }
    return () => { disposed = true }
  }, [trackId, contentUri, access, modifiedTimeMs, sizeBytes, accessible, key])

  return <span className={`mobile-artwork ${className}`}>{cover?.key === key && accessible && access === 'available' ? <img src={cover.uri} alt="" loading="lazy" onError={() => setCover(null)} /> : <MobileIcon name="music" />}</span>
}
