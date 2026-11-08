import type { MobileTrack } from '../../../../src/shared/mobile'
import { MobileIcon } from '../../components/MobileIcon'
import { TrackArtwork } from '../../components/TrackArtwork'

export function LibraryTrackRow({ track, accessible, disabled, onPlay, index, total, height }: { track: MobileTrack; accessible: boolean; disabled: boolean; onPlay: () => void; index: number; total: number; height: number }) {
  return (
    <li data-track-id={track.id} data-track-index={index} aria-setsize={total} aria-posinset={index + 1} className="mobile-library-track" style={{ height }}>
      <TrackArtwork className="mobile-track-cover" track={track} accessible={accessible} />
      <div className="mobile-track-info"><strong>{track.title}</strong><p>{track.artist ?? track.relativePath}</p>{track.access === 'missing' && <span className="mobile-error">Dosya bulunamadı</span>}</div>
      <button type="button" className="mobile-icon-button" disabled={disabled || !accessible || track.access !== 'available'} onClick={onPlay} aria-label={`${track.title} çal`}><MobileIcon name="play" /></button>
    </li>
  )
}
