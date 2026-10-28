export const BACKGROUNDS = [
  { value: 'aurora', label: 'Aurora' },
  { value: 'veil', label: 'Gece perdesi' },
  { value: 'lines', label: 'Akış çizgileri' },
  { value: 'none', label: 'Sade' },
] as const

export type Appearance = {
  theme: 'dark' | 'light'
  background: typeof BACKGROUNDS[number]['value']
}

const STORAGE_KEY = 'melodify.appearance'
const DEFAULT_APPEARANCE: Appearance = { theme: 'dark', background: 'aurora' }

export function readAppearance(): Appearance {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (value && typeof value === 'object') {
      const saved = value as Record<string, unknown>
      return {
        theme: saved.theme === 'light' ? 'light' : 'dark',
        background: BACKGROUNDS.find((item) => item.value === saved.background)?.value ?? 'aurora',
      }
    }
  } catch {
    // A blocked storage area or an invalid old preference must not prevent startup.
  }
  return { ...DEFAULT_APPEARANCE }
}

export function applyAppearance(appearance: Appearance) {
  document.documentElement.dataset.theme = appearance.theme
  document.documentElement.dataset.background = appearance.background
}

export function saveAppearance(appearance: Appearance) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
  } catch {
    // Appearance controls still work for this session when storage is unavailable.
  }
}
