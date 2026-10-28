import { useLayoutEffect, useState } from 'react'
import { applyAppearance, BACKGROUNDS, readAppearance, saveAppearance } from '../shared/appearance'

export function AppearanceControls() {
  const [appearance, setAppearance] = useState(readAppearance)

  useLayoutEffect(() => {
    applyAppearance(appearance)
    saveAppearance(appearance)
  }, [appearance])

  const toggleLabel = appearance.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'

  return (
    <div className="appearance-controls" role="group" aria-label="Görünüm tercihleri">
      <label className="background-select" title="Uygulama arka planı">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
        </svg>
        <select
          aria-label="Uygulama arka planı"
          value={appearance.background}
          onChange={(event) => {
            const background = BACKGROUNDS.find((item) => item.value === event.target.value)?.value
            if (background) setAppearance((previous) => ({ ...previous, background }))
          }}
        >
          {BACKGROUNDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <button
        type="button"
        className="theme-toggle"
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={() => setAppearance((previous) => ({ ...previous, theme: previous.theme === 'dark' ? 'light' : 'dark' }))}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {appearance.theme === 'dark' ? (
            <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>
          ) : (
            <path d="M20.8 13a8.8 8.8 0 0 1-9.8-9.8A9 9 0 1 0 20.8 13Z" />
          )}
        </svg>
      </button>
    </div>
  )
}
