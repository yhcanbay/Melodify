import type { Appearance } from '../../../src/shared/appearance'
import type { MobileSnapshot } from '../../../src/shared/mobile'
import { DownloadsScreen } from '../features/downloads/DownloadsScreen'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { PlayerScreen } from '../features/player/PlayerScreen'
import { QueueScreen } from '../features/player/QueueScreen'
import { PlaylistsScreen } from '../features/playlists/PlaylistsScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import type { MobileNavigation } from './navigation'

export function MobileScreen({ navigation, snapshot, appearance, onAppearanceChange, onRefresh, onOpenPlaylist }: {
  navigation: MobileNavigation
  snapshot: MobileSnapshot
  appearance: Appearance
  onAppearanceChange: (value: Appearance) => void
  onRefresh: () => void
  onOpenPlaylist: (playlistId: string) => void
}) {
  if (navigation.overlay === 'settings') {
    return <SettingsScreen snapshot={snapshot} appearance={appearance} onAppearanceChange={onAppearanceChange} onRefresh={onRefresh} />
  }
  if (navigation.overlay === 'player') return <PlayerScreen snapshot={snapshot.playback} />

  switch (navigation.tab) {
    case 'library': return <LibraryScreen snapshot={snapshot.library} />
    case 'downloads': return <DownloadsScreen snapshot={snapshot.downloads} folder={snapshot.settings.downloadFolder} />
    case 'playlists': return <PlaylistsScreen snapshot={snapshot.playlists} library={snapshot.library} selectedId={navigation.playlistId} onOpen={onOpenPlaylist} />
    case 'queue': return <QueueScreen snapshot={snapshot.playback} />
  }
}
