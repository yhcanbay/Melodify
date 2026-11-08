import { createRoot } from 'react-dom/client'
import { MobileApp } from '../../../mobile/src/app/MobileApp'
import { mobilePlatform } from '../../../mobile/src/platform'
import { createPreviewSnapshot } from '../../../mobile/src/platform/initialSnapshot'
import type { MobilePlaybackCommand, MobilePlaylistCommand } from '../../../src/shared/mobile'
import '../../../mobile/src/styles/mobile.css'

// This fixture has its own build entry; it is never included in the Android app.
const snapshot = createPreviewSnapshot()
snapshot.library.availability = { state: 'available', message: 'Test' }
snapshot.playback.availability = { state: 'available', message: 'Test' }
snapshot.playlists.availability = { state: 'available', message: 'Test' }
snapshot.library.folder = { id: 'fixture-library', treeUri: 'content://fixture/tree/music', name: 'Test kitaplığı', access: 'granted' }
snapshot.library.tracks = Array.from({ length: 10000 }, (_, index) => ({
  id: `fixture-track-${index}`, libraryId: 'fixture-library', contentUri: `content://fixture/music/${index}`,
  title: `Parça ${String(index).padStart(5, '0')}`, fileName: `Parça ${index}.mp3`, relativePath: `Albüm/Parça ${index}.mp3`,
  artist: 'Sanatçı', durationMs: 100000, youtubeId: null, access: 'available' as const, modifiedTimeMs: index, sizeBytes: 1000,
}))
const listeners = new Set<() => void>()
const commands: MobilePlaybackCommand[] = []
const playlistCommands: MobilePlaylistCommand[] = []
let coverRequests = 0
const fixture = { commands, playlistCommands, failNextPlaylistCommand: false, get coverRequests() { return coverRequests } }
Object.assign(window, { fixture })
snapshot.playlists.playlists = [{ id: 'fixture-playlist', libraryId: 'fixture-library', name: 'Yol müzikleri', description: 'Deneme listesi', trackIds: ['fixture-track-0', 'fixture-track-1', 'fixture-track-2'], createdAt: '2026-11-09', updatedAt: '2026-11-09' }]
mobilePlatform.readSnapshot = async () => structuredClone(snapshot)
mobilePlatform.subscribe = (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } }
mobilePlatform.library.getCover = async () => { coverRequests++; return { uri: null } }
mobilePlatform.playback.dispatch = async (command) => {
  commands.push(command)
  if (command.type === 'loadQueue') {
    snapshot.playback.queue = command.tracks
    snapshot.playback.currentTrackId = command.startTrackId
    snapshot.playback.isPlaying = true
    snapshot.playback.durationMs = 100000
  }
  if (command.type === 'play' || command.type === 'pause') snapshot.playback.isPlaying = command.type === 'play'
  if (command.type === 'seek') snapshot.playback.positionMs = command.positionMs
  if (command.type === 'setVolume') snapshot.playback.volume = command.volume
  if (command.type === 'setRepeat') snapshot.playback.repeat = command.mode
  if (command.type === 'setShuffle') snapshot.playback.shuffle = command.enabled
  if (command.type === 'reorder') snapshot.playback.queue = command.trackIds.map((id) => snapshot.playback.queue.find((track) => track.id === id)!)
  if (command.type === 'selectTrack') snapshot.playback.currentTrackId = command.trackId
  listeners.forEach((listener) => listener())
}
mobilePlatform.playlists.dispatch = async (command) => {
  playlistCommands.push(command)
  if (fixture.failNextPlaylistCommand) { fixture.failNextPlaylistCommand = false; throw new Error('Test kaydetme hatası') }
  if (command.type === 'create') snapshot.playlists.playlists.push({ ...command, id: 'created-playlist', trackIds: [], createdAt: '2026-11-09', updatedAt: '2026-11-09' })
  if (command.type === 'delete') snapshot.playlists.playlists = snapshot.playlists.playlists.filter((playlist) => playlist.id !== command.playlistId)
  const playlist = 'playlistId' in command ? snapshot.playlists.playlists.find((item) => item.id === command.playlistId) : null
  if (playlist && command.type === 'update') { playlist.name = command.name; playlist.description = command.description }
  if (playlist && command.type === 'addTrack' && !playlist.trackIds.includes(command.trackId)) playlist.trackIds.push(command.trackId)
  if (playlist && command.type === 'removeTrack') playlist.trackIds = playlist.trackIds.filter((id) => id !== command.trackId)
  if (playlist && command.type === 'reorder') playlist.trackIds = command.trackIds
  listeners.forEach((listener) => listener())
}

createRoot(document.getElementById('root')!).render(<MobileApp />)
