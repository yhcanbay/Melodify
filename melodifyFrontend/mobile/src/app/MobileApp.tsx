import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import melodifyIcon from '../../../public/melodify-icon.svg'
import { applyAppearance, readAppearance, saveAppearance } from '../../../src/shared/appearance'
import { MobileIcon } from '../components/MobileIcon'
import { MiniPlayer } from '../features/player/MiniPlayer'
import { mobilePlatform } from '../platform'
import { describePlatformError } from '../platform/errors'
import { manageSubscriptions } from '../platform/subscriptions'
import { initialNavigation, MOBILE_TABS, reduceNavigation } from './navigation'
import { MobileScreen } from './MobileScreen'
import { useMobileSnapshot } from './useMobileSnapshot'

export function MobileApp() {
  const [navigation, navigate] = useReducer(reduceNavigation, initialNavigation)
  const [appearance, setAppearance] = useState(readAppearance)
  const [backError, setBackError] = useState<string | null>(null)
  const { snapshot, phase, error, subscriptionError, refresh, connectionAttempt } = useMobileSnapshot(mobilePlatform)
  const contentRef = useRef<HTMLElement>(null)

  const goBack = useCallback(() => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
    if (dialog) {
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
      return
    }
    navigate({ type: 'back' })
  }, [])

  useLayoutEffect(() => {
    applyAppearance(appearance)
    saveAppearance(appearance)
  }, [appearance])

  useEffect(() => {
    contentRef.current?.focus()
    contentRef.current?.scrollTo?.(0, 0)
  }, [navigation])

  useEffect(() => {
    if (mobilePlatform.kind !== 'android') return
    let active = true
    setBackError(null)
    const unsubscribe = manageSubscriptions([
      mobilePlatform.settings.addListener('backRequested', goBack),
    ], (cause) => { if (active) setBackError(describePlatformError(cause)) })
    return () => {
      active = false
      unsubscribe()
    }
  }, [connectionAttempt, goBack])

  useEffect(() => {
    if (mobilePlatform.kind !== 'android') return
    void mobilePlatform.settings.setBackNavigation({ enabled: navigation.overlay !== null || navigation.tab !== 'library' })
      .catch((cause) => setBackError(describePlatformError(cause)))
  }, [navigation, connectionAttempt])

  const activeLabel = navigation.overlay === 'settings' ? 'Ayarlar' : navigation.overlay === 'player' ? 'Oynatıcı' : MOBILE_TABS.find((tab) => tab.id === navigation.tab)!.label

  return (
    <div className="mobile-shell">
      <div className="mobile-ambient" aria-hidden="true" />
      <header className="mobile-header">
        {navigation.overlay || navigation.playlistId ? (
          <button type="button" className="mobile-icon-button" aria-label="Geri" onClick={goBack}>
            <MobileIcon name="back" />
          </button>
        ) : <img src={melodifyIcon} width="40" height="40" alt="" />}
        <span className="mobile-brand">
          Melodify<small>Her anın bir melodisi var.</small>
        </span>
        {!navigation.overlay && (
          <button type="button" className="mobile-icon-button" aria-label="Ayarları aç" onClick={() => navigate({ type: 'openSettings' })}>
            <MobileIcon name="settings" />
          </button>
        )}
      </header>
      <main className="mobile-content" ref={contentRef} tabIndex={-1} aria-label={activeLabel}>
        {mobilePlatform.kind === 'web' && (
          <p className="mobile-preview-note">Tarayıcı önizlemesi · Cihaz özellikleri Android uygulamasında açılır.</p>
        )}
        {(error || subscriptionError || backError) && (
          <div className="mobile-error" role="alert">
            <p>{error ?? subscriptionError ?? backError}</p>
            <button type="button" onClick={refresh}>Tekrar dene</button>
          </div>
        )}
        {!snapshot && phase === 'loading' && <p role="status" className="mobile-loading">Melodify hazırlanıyor…</p>}
        {snapshot && (
          <MobileScreen
            navigation={navigation}
            snapshot={snapshot}
            appearance={appearance}
            onAppearanceChange={setAppearance}
            onRefresh={refresh}
            onOpenPlaylist={(playlistId) => navigate({ type: 'openPlaylist', playlistId })}
          />
        )}
      </main>
      <footer className="mobile-footer">
        {snapshot && <MiniPlayer snapshot={snapshot.playback} onOpen={() => navigate({ type: 'openPlayer' })} />}
        <nav className="mobile-tabs" aria-label="Ana gezinme">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={navigation.tab === tab.id && !navigation.overlay ? 'page' : undefined}
              onClick={() => navigate({ type: 'selectTab', tab: tab.id })}
            >
              <MobileIcon name={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </footer>
    </div>
  )
}
