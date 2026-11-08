import type { MobilePlaybackSnapshot } from '../../../../src/shared/mobile'
import { MobileIcon } from '../../components/MobileIcon'
import { usePlaybackCommand } from './usePlaybackCommand'
import { TrackArtwork } from '../../components/TrackArtwork'

export function MiniPlayer({ snapshot, onOpen }: { snapshot: MobilePlaybackSnapshot; onOpen: () => void }) {
  const { dispatch, pending, error } = usePlaybackCommand()
  const track = snapshot.queue.find((item) => item.id === snapshot.currentTrackId)
  return (
    <div className="mobile-mini-bar">
      <button
      className="mobile-mini-player"
      type="button"
      onClick={onOpen}
      disabled={!track}
      aria-label={track ? `${track.title}, oynatıcıyı aç` : 'Henüz parça seçilmedi'}
    >
      <TrackArtwork className="mobile-mini-art" track={track} />
      <span>
        <strong>{track?.title ?? 'Müziğine hazır'}</strong>
        <small>{track ? track.artist ?? 'Bilinmeyen sanatçı' : 'Dinlemek için bir parça seç'}</small>
      </span>
      </button>
      {track && <button type="button" className="mobile-icon-button mobile-mini-toggle" aria-label={snapshot.isPlaying ? 'Mini oynatıcıdan duraklat' : 'Mini oynatıcıdan oynat'} disabled={pending || snapshot.restoring} onClick={() => { void dispatch({ type: snapshot.isPlaying ? 'pause' : 'play' }) }}><MobileIcon name={snapshot.isPlaying ? 'pause' : 'play'} /></button>}
      {error && <span className="mobile-mini-error" role="alert">{error}</span>}
    </div>
  )
}
