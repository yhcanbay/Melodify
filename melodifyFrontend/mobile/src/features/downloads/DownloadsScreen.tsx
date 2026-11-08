import { useState } from 'react'
import type { FormEvent } from 'react'
import type { MobileDownloadsSnapshot, MobileFolder } from '../../../../src/shared/mobile'
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder'
import { mobilePlatform } from '../../platform'
import { describePlatformError } from '../../platform/errors'
import { DownloadJobCard } from './DownloadJobCard'
import { isDownloadActive } from './downloadLabels'

export function DownloadsScreen({ snapshot, folder }: { snapshot: MobileDownloadsSnapshot; folder: MobileFolder | null }) {
  const [query, setQuery] = useState(snapshot.search.query)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = pending || snapshot.search.state === 'searching' || snapshot.jobs.some(isDownloadActive)

  async function perform(action: () => Promise<unknown>) {
    setPending(true)
    setError(null)
    try { await action() } catch (failure) { setError(describePlatformError(failure)) }
    finally { setPending(false) }
  }

  function search(event: FormEvent) {
    event.preventDefault()
    if (!query.trim() || busy) return
    void perform(() => mobilePlatform.downloads.search({ query: query.trim(), limit: 5 }))
  }

  function enqueue(sourceUrl: string) {
    if (!folder) return
    void perform(() => mobilePlatform.downloads.enqueue({ sourceUrl, targetFolderId: folder.id }))
  }
  return (
    <section aria-labelledby="downloads-title">
      <p className="mobile-eyebrow">KEŞFET VE SAKLA</p>
      <h1 id="downloads-title">Ara ve indir</h1>
      <p className="mobile-description">Bulduğun müziği çevrimdışı dinlemek için kaydet.</p>
      {snapshot.availability.state !== 'available' ? (
        <FeaturePlaceholder icon="search" title="Yeni müziklere doğru" description="Arama sonuçların ve indirmelerin burada görünecek." availability={snapshot.availability} />
      ) : (
        <>
          <p className="mobile-preview-note">Arama ve indirme boyunca Melodify’ı açık tut.</p>
          {!snapshot.engineReady && <p role="status">Yeni arama ve indirme için Ayarlar'dan araçları doğrula.</p>}
          {snapshot.persistenceError && <p className="mobile-error" role="alert">{snapshot.persistenceError}</p>}
          <div className="mobile-download-target">
            <span>İndirme klasörü<strong>{folder?.name ?? 'Henüz seçilmedi'}</strong></span>
            <button type="button" className="mobile-action-button" disabled={busy} onClick={() => { void perform(() => mobilePlatform.settings.pickDownloadFolder()) }}>Klasör seç</button>
          </div>
          {folder?.access === 'revoked' && <p role="alert">Klasör izni kayboldu. Klasörü yeniden seç.</p>}
          <form className="mobile-search-form" onSubmit={search}>
            <label htmlFor="download-query">Parça veya sanatçı</label>
            <input id="download-query" type="search" value={query} maxLength={200} disabled={busy} onChange={(event) => setQuery(event.target.value)} placeholder="Bir şarkı ara…" />
            <button type="submit" className="mobile-action-button" disabled={busy || !snapshot.engineReady || !query.trim()}>Ara</button>
          </form>
          {snapshot.search.state === 'searching' && (
            <div className="mobile-search-status"><p role="status">YouTube'da aranıyor…</p><button type="button" className="mobile-action-button" onClick={() => { void perform(() => mobilePlatform.downloads.cancelSearch()) }}>Aramayı iptal et</button></div>
          )}
          {(error || snapshot.search.error) && <p className="mobile-error" role="alert">{error ?? snapshot.search.error}</p>}
          {snapshot.search.state === 'completed' && snapshot.search.results.length === 0 && <p role="status">Sonuç bulunamadı. Başka bir arama dene.</p>}
          <ul className="mobile-search-results" aria-label="Arama sonuçları">
            {snapshot.search.results.map((result) => (
              <li key={result.id}>
                <div><strong>{result.title}</strong><p>{result.uploader} · {result.durationText}</p></div>
                <button type="button" className="mobile-action-button" aria-label={`${result.title} indir`} disabled={busy || !snapshot.engineReady || folder?.access !== 'granted'} onClick={() => enqueue(result.webpageUrl)}>İndir</button>
              </li>
            ))}
          </ul>
          {snapshot.jobs.length > 0 && <h2 className="mobile-downloads-heading">İndirmeler</h2>}
          {[...snapshot.jobs].reverse().map((job) => (
            <DownloadJobCard
              key={job.id}
              job={job}
              playback={snapshot.probePlayback}
              onCancel={() => { void perform(() => mobilePlatform.downloads.cancel({ jobId: job.id })) }}
              onPlay={() => { void perform(() => mobilePlatform.downloads.playProbe({ jobId: job.id })) }}
              onPause={() => { void perform(() => mobilePlatform.downloads.pauseProbe()) }}
            />
          ))}
        </>
      )}
    </section>
  )
}
