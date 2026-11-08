export const MOBILE_TABS = [
  { id: 'library', label: 'Kitaplık', icon: 'library' },
  { id: 'downloads', label: 'Ara ve indir', icon: 'search' },
  { id: 'playlists', label: 'Listeler', icon: 'playlists' },
  { id: 'queue', label: 'Sıra', icon: 'queue' },
] as const

export type MobileTab = typeof MOBILE_TABS[number]['id']
export type MobileNavigation = { tab: MobileTab; overlay: 'settings' | 'player' | null; playlistId: string | null }
export type NavigationAction =
  | { type: 'selectTab'; tab: MobileTab }
  | { type: 'openPlaylist'; playlistId: string }
  | { type: 'openSettings' | 'openPlayer' | 'back' }

export const initialNavigation: MobileNavigation = { tab: 'library', overlay: null, playlistId: null }

export function reduceNavigation(state: MobileNavigation, action: NavigationAction): MobileNavigation {
  switch (action.type) {
    case 'selectTab': return { tab: action.tab, overlay: null, playlistId: null }
    case 'openPlaylist': return { tab: 'playlists', overlay: null, playlistId: action.playlistId }
    case 'openSettings': return { ...state, overlay: 'settings' }
    case 'openPlayer': return { ...state, overlay: 'player' }
    case 'back': return state.overlay ? { ...state, overlay: null } : state.playlistId ? { ...state, playlistId: null } : initialNavigation
  }
}
