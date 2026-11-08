import type { MobilePlaybackSnapshot } from '../../../../src/shared/mobile'
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder'
import { usePlaybackCommand } from './usePlaybackCommand'
import { TrackArtwork } from '../../components/TrackArtwork'
import { RangeControl } from '../../components/RangeControl'

function time(value: number) {
  const seconds = Math.floor(value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function PlayerScreen({ snapshot }: { snapshot: MobilePlaybackSnapshot }) {
  const { dispatch, pending, error } = usePlaybackCommand()
  const track = snapshot.queue.find((item) => item.id === snapshot.currentTrackId)
  const disabled = pending || snapshot.restoring || !track
  return (
    <section aria-labelledby="player-title">
      <h1 id="player-title">Şimdi çalıyor</h1>
      {!track ? <FeaturePlaceholder icon="music" title="Bir parça seç" description="Kitaplıktan dinlemek istediğin parçayı seç." availability={snapshot.availability} /> : (
        <div className="mobile-player-controls">
          <TrackArtwork className="mobile-player-art" track={track} />
          <div className="mobile-player-meta"><h2 title={track.title}>{track.title}</h2><p title={track.artist ?? track.fileName}>{track.artist ?? 'Bilinmeyen sanatçı'}</p></div>
          {snapshot.repeat === 'once' && <p>{snapshot.repeatPass === 0 ? 'İlk çalma' : 'İkinci çalma'}</p>}
          <label>Konum · {time(snapshot.positionMs)} / {time(snapshot.durationMs)}<RangeControl key={track.id} label="Parça konumu" value={snapshot.positionMs} max={snapshot.durationMs || 1} disabled={disabled || !snapshot.durationMs} onCommit={(positionMs) => dispatch({ type: 'seek', positionMs })} /></label>
          <div className="mobile-playback-buttons">
            <button className="mobile-action-button" disabled={disabled} onClick={() => { void dispatch({ type: 'previous' }) }}>Önceki</button>
            <button className="mobile-action-button" disabled={disabled} onClick={() => { void dispatch({ type: snapshot.isPlaying ? 'pause' : 'play' }) }}>{snapshot.isPlaying ? 'Duraklat' : 'Oynat'}</button>
            <button className="mobile-action-button" disabled={disabled} onClick={() => { void dispatch({ type: 'next' }) }}>Sonraki</button>
          </div>
          <label>Tekrar<select aria-label="Tekrar modu" value={snapshot.repeat} disabled={disabled} onChange={(event) => { void dispatch({ type: 'setRepeat', mode: event.target.value as MobilePlaybackSnapshot['repeat'] }) }}><option value="off">Kapalı</option><option value="once">Her parçayı bir kez tekrarla</option><option value="one">Aynı parçayı sürekli tekrarla</option></select></label>
          <button className="mobile-action-button" disabled={disabled} aria-pressed={snapshot.shuffle} onClick={() => { void dispatch({ type: 'setShuffle', enabled: !snapshot.shuffle }) }}>Karıştırma {snapshot.shuffle ? 'açık' : 'kapalı'}</button>
          <label>Uygulama sesi · %{Math.round(snapshot.volume * 100)}<RangeControl label="Uygulama ses düzeyi" value={snapshot.volume} max={1} step={0.05} disabled={disabled} onCommit={(volume) => dispatch({ type: 'setVolume', volume })} /></label>
        </div>
      )}
      {(error || snapshot.error) && <p className="mobile-error" role="alert">{error ?? snapshot.error}</p>}
      {snapshot.restoring && <p role="status">Son çalma sıran yükleniyor…</p>}
    </section>
  )
}
