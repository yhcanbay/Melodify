import { useMemo, useState } from 'react'
import type { MobileLibrarySnapshot } from '../../../../src/shared/mobile'
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder'
import { mobilePlatform } from '../../platform'
import { describePlatformError } from '../../platform/errors'
import { VirtualTrackList } from './VirtualTrackList'

const accessMessages = {
  revoked: 'Kitaplık izni kaldırılmış. Erişmek için klasörü yeniden seç.',
  missing: 'Kitaplık klasörü bulunamıyor. Taşınmış veya silinmiş olabilir. Son kayıtların korunuyor.',
  unmounted: 'Kitaplığın bulunduğu depolama bağlı değil. SD kartı kontrol edip yeniden tara.',
  granted: '',
}

export function LibraryScreen({ snapshot }: { snapshot: MobileLibrarySnapshot }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('title')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tracks = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr')
    return snapshot.tracks.filter((track) => `${track.title} ${track.artist ?? ''} ${track.relativePath}`.toLocaleLowerCase('tr').includes(needle))
      .sort((a, b) => sort === 'modified' ? b.modifiedTimeMs - a.modifiedTimeMs :
        (sort === 'path' ? a.relativePath : a.title).localeCompare(sort === 'path' ? b.relativePath : b.title, 'tr'))
  }, [snapshot.tracks, query, sort])
  const busy = pending || snapshot.scanning

  async function perform(action: () => Promise<unknown>) {
    setPending(true)
    setError(null)
    try { await action() } catch (failure) { setError(describePlatformError(failure)) }
    finally { setPending(false) }
  }

  function play(trackId: string) {
    const playable = tracks.filter((track) => track.access === 'available')
    void perform(() => mobilePlatform.playback.dispatch({ type: 'loadQueue', tracks: playable, startTrackId: trackId }))
  }

  return (
    <section aria-labelledby="library-title">
      <p className="mobile-eyebrow">MÜZİĞİN HEP YANINDA</p>
      <h1 id="library-title">Kitaplığın</h1>
      <p className="mobile-description">Sevdiğin parçalar, internet olmadan da seninle.</p>
      {snapshot.availability.state !== 'available' ? (
        <FeaturePlaceholder icon="library" title="Müziğine bir yer aç" description="Seçtiğin klasördeki parçalar burada bir araya gelecek." availability={snapshot.availability} />
      ) : (
        <>
          <details className="mobile-library-folder" key={snapshot.folder?.id ?? 'no-folder'} open={!snapshot.folder}>
            <summary>Kitaplık · <strong>{snapshot.folder?.name ?? 'Klasör seç'}</strong></summary>
            <div className="mobile-download-target">
            <span>Kitaplık klasörü<strong>{snapshot.folder?.name ?? 'Henüz seçilmedi'}</strong></span>
            <button type="button" className="mobile-action-button" disabled={busy} onClick={() => { void perform(() => mobilePlatform.library.pickFolder()) }}>Kitaplık seç</button>
            </div>
            {snapshot.folder && <button type="button" className="mobile-action-button" disabled={busy} onClick={() => { void perform(() => mobilePlatform.library.scan()) }}>Yeniden tara</button>}
          </details>
          {snapshot.scanning && <p role="status">Kitaplık okunuyor…</p>}
          {snapshot.folder && snapshot.folder.access !== 'granted' && <p className="mobile-error" role="alert">{accessMessages[snapshot.folder.access]}</p>}
          {(error || snapshot.error) && <p className="mobile-error" role="alert">{error ?? snapshot.error}</p>}
          {snapshot.folder && (
            <>
              <div className="mobile-library-filters">
                <label htmlFor="library-query">Kitaplıkta ara<input id="library-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Parça, sanatçı veya klasör" /></label>
                <label htmlFor="library-sort">Sıralama<select id="library-sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="title">Parça adı</option><option value="modified">En yeni</option><option value="path">Klasör ve dosya</option></select></label>
              </div>
              <p role="status">{tracks.length} parça{query ? ' bulundu' : ''}</p>
              {tracks.length > 0 && <VirtualTrackList tracks={tracks} accessible={snapshot.folder?.access === 'granted'} disabled={busy} onPlay={play} resetKey={`${snapshot.folder.id}:${query}:${sort}`} />}
              {!tracks.length && !busy && <p>{query ? 'Aramana uygun parça bulunamadı.' : 'Bu klasörde desteklenen ses dosyası bulunamadı.'}</p>}
            </>
          )}
        </>
      )}
    </section>
  )
}
