import type { MobilePlaybackSnapshot } from '../../../../src/shared/mobile'
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder'
import { usePlaybackCommand } from './usePlaybackCommand'
import { QueueList } from './QueueList'

export function QueueScreen({ snapshot }: { snapshot: MobilePlaybackSnapshot }) {
  const { dispatch, pending, error } = usePlaybackCommand()
  return (
    <section aria-labelledby="queue-title">
      <p className="mobile-eyebrow">SIRADAKİ SENİN SEÇİMİN</p>
      <h1 id="queue-title">Çalma sırası</h1>
      <p className="mobile-description">Çalacak parçaları gör ve dinleme akışını düzenle.</p>
      {snapshot.queue.length === 0 ? <FeaturePlaceholder icon="queue" title="Sırada ne var?" description="Bir parça seçtiğinde çalma sıran burada görünecek." availability={snapshot.availability} /> : (
        <QueueList tracks={snapshot.queue} currentTrackId={snapshot.currentTrackId} pending={pending || snapshot.restoring} onSelect={(trackId) => { void dispatch({ type: 'selectTrack', trackId }) }} onReorder={(trackIds) => { void dispatch({ type: 'reorder', trackIds }) }} />
      )}
      {error && <p className="mobile-error" role="alert">{error}</p>}
    </section>
  )
}
