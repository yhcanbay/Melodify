import { useState } from 'react'
import { BACKGROUNDS } from '../../../../src/shared/appearance'
import type { Appearance } from '../../../../src/shared/appearance'
import type { MobileSnapshot } from '../../../../src/shared/mobile'
import { TransferSettings } from '../transfer/TransferSettings'
import { mobilePlatform } from '../../platform'
import { describePlatformError } from '../../platform/errors'
import { isDownloadActive } from '../downloads/downloadLabels'

export function SettingsScreen({ snapshot, appearance, onAppearanceChange, onRefresh }: {
  snapshot: MobileSnapshot
  appearance: Appearance
  onAppearanceChange: (value: Appearance) => void
  onRefresh: () => void
}) {
  const [preparing, setPreparing] = useState(false)
  const [preparationError, setPreparationError] = useState<string | null>(null)
  const [folderBusy, setFolderBusy] = useState(false)
  const [folderError, setFolderError] = useState<string | null>(null)
  const busy = preparing || folderBusy || snapshot.library.scanning || snapshot.downloads.jobs.some(isDownloadActive) || snapshot.downloads.search.state === 'searching'

  async function pickFolder(kind: 'library' | 'download') {
    setFolderBusy(true)
    setFolderError(null)
    try { await (kind === 'library' ? mobilePlatform.library.pickFolder() : mobilePlatform.settings.pickDownloadFolder()) }
    catch (failure) { setFolderError(describePlatformError(failure)) }
    finally { setFolderBusy(false); onRefresh() }
  }

  async function prepareTools() {
    setPreparing(true)
    setPreparationError(null)
    try {
      await mobilePlatform.settings.initializeTools()
    } catch (error) {
      setPreparationError(describePlatformError(error))
    } finally {
      setPreparing(false)
      onRefresh()
    }
  }

  return (
    <section aria-labelledby="settings-title">
      <p className="mobile-eyebrow">SANA GÖRE MELODIFY</p>
      <h1 id="settings-title">Ayarlar</h1>
      <section className="mobile-settings-card" aria-labelledby="appearance-title">
        <h2 id="appearance-title">Görünüm</h2>
        <label>Tema<select value={appearance.theme} onChange={(event) => onAppearanceChange({ ...appearance, theme: event.target.value === 'light' ? 'light' : 'dark' })}><option value="dark">Koyu</option><option value="light">Açık</option></select></label>
        <label>Arka plan<select value={appearance.background} onChange={(event) => {
          const background = BACKGROUNDS.find((item) => item.value === event.target.value)?.value
          if (background) onAppearanceChange({ ...appearance, background })
        }}>{BACKGROUNDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </section>
      <section className="mobile-settings-card" aria-labelledby="folders-title">
        <h2 id="folders-title">Klasörler</h2>
        <dl><div><dt>Kitaplık</dt><dd>{snapshot.library.folder?.name ?? 'Henüz seçilmedi'}</dd></div><div><dt>İndirme hedefi</dt><dd>{snapshot.settings.downloadFolder?.name ?? 'Henüz seçilmedi'}</dd></div></dl>
        <p>Kitaplık klasörünü Kitaplık ekranından, indirme hedefini Ara ve indir ekranından ayrı ayrı seçebilirsin.</p>
        {mobilePlatform.kind === 'android' && <div className="mobile-button-row"><button className="mobile-action-button" disabled={busy} onClick={() => { void pickFolder('library') }}>Kitaplık klasörünü değiştir</button><button className="mobile-action-button" disabled={busy} onClick={() => { void pickFolder('download') }}>İndirme klasörünü değiştir</button></div>}
        {folderError && <p className="mobile-error" role="alert">{folderError}</p>}
      </section>
      <TransferSettings />
      <section className="mobile-settings-card" aria-labelledby="tools-title">
        <h2 id="tools-title">İndirme araçları</h2>
        <dl>{snapshot.settings.tools.map((tool) => <div key={tool.name}><dt>{tool.name}</dt><dd>{tool.ready ? tool.version ?? 'Hazır' : 'Henüz hazır değil'}</dd></div>)}</dl>
        {mobilePlatform.kind === 'android' && (
          <button
            type="button"
            className="mobile-action-button"
            disabled={busy || snapshot.settings.toolStatus === 'preparing' || snapshot.settings.toolStatus === 'ready'}
            onClick={() => { void prepareTools() }}
          >
            {preparing ? 'Araçlar doğrulanıyor…' : snapshot.settings.toolStatus === 'ready' ? 'Araçlar doğrulandı' : 'Araçları doğrula'}
          </button>
        )}
        {preparing && <p role="status">İlk hazırlık birkaç dakika sürebilir.</p>}
        {(preparationError || snapshot.settings.toolError) && <p role="alert">{preparationError ?? snapshot.settings.toolError}</p>}
        <p>Çerez dosyası: {snapshot.settings.cookiesImported ? 'İçe aktarıldı' : 'İçe aktarılmadı'}</p>
      </section>
      <details className="mobile-settings-card"><summary>Uygulama bilgileri</summary><dl><div><dt>Sürüm</dt><dd>{snapshot.settings.appVersion}</dd></div><div><dt>Ortam</dt><dd>{snapshot.settings.platform === 'android' ? `Android API ${snapshot.settings.androidApi}` : 'Tarayıcı önizlemesi'}</dd></div><div><dt>İşlemci</dt><dd>{snapshot.settings.supportedAbis.join(', ') || '—'}</dd></div><div><dt>Köprü protokolü</dt><dd>{snapshot.settings.protocolVersion}</dd></div></dl></details>
    </section>
  )
}
