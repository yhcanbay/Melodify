import { useMemo, useState } from 'react'
import type { MobileLibrarySnapshot, MobilePlaylistCommand, MobilePlaylistsSnapshot } from '../../../../src/shared/mobile'
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder'
import { MobileDialog } from '../../components/MobileDialog'
import { TrackArtwork } from '../../components/TrackArtwork'
import { mobilePlatform } from '../../platform'
import { describePlatformError } from '../../platform/errors'
import { QueueList } from '../player/QueueList'
import { PlaylistEditor } from './PlaylistEditor'

export function PlaylistsScreen({ snapshot, library, selectedId, onOpen }: {
  snapshot: MobilePlaylistsSnapshot
  library: MobileLibrarySnapshot
  selectedId: string | null
  onOpen: (id: string) => void
}) {
  const [dialog, setDialog] = useState<'create' | 'edit' | 'delete' | 'add' | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [removeQuery, setRemoveQuery] = useState('')
  const selected = snapshot.playlists.find((playlist) => playlist.id === selectedId)
  const trackMap = useMemo(() => new Map(library.tracks.map((track) => [track.id, track])), [library.tracks])
  const tracks = selected?.trackIds.flatMap((id) => trackMap.get(id) ?? []) ?? []
  const hasMissingTracks = !!selected && tracks.length !== selected.trackIds.length
  const selectedTrackIds = useMemo(() => new Set(selected?.trackIds ?? []), [selected?.trackIds])
  const candidates = dialog === 'add' ? library.tracks.filter((track) => track.access === 'available' && !selectedTrackIds.has(track.id) && `${track.title} ${track.artist ?? ''}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))) : []
  const removable = tracks.filter((track) => track.title.toLocaleLowerCase('tr').includes(removeQuery.toLocaleLowerCase('tr')))

  async function perform(action: () => Promise<unknown>) {
    setPending(true)
    setError(null)
    try { await action(); return true } catch (failure) { setError(describePlatformError(failure)); return false }
    finally { setPending(false) }
  }

  function dispatch(command: MobilePlaylistCommand) { return perform(() => mobilePlatform.playlists.dispatch(command)) }
  function openDialog(value: typeof dialog) { setError(null); setQuery(''); setDialog(value) }

  async function play(shuffle: boolean) {
    let playable = tracks.filter((track) => track.access === 'available')
    if (shuffle) {
      playable = [...playable]
      for (let index = playable.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1))
        ;[playable[index], playable[other]] = [playable[other], playable[index]]
      }
    }
    if (playable.length) await perform(async () => {
      await mobilePlatform.playback.dispatch({ type: 'loadQueue', tracks: playable, startTrackId: playable[0].id })
      if (shuffle) await mobilePlatform.playback.dispatch({ type: 'setShuffle', enabled: true })
    })
  }

  if (snapshot.availability.state !== 'available') return (
    <section aria-labelledby="playlists-title"><p className="mobile-eyebrow">HER ANA BİR LİSTE</p><h1 id="playlists-title">Listelerin</h1><p className="mobile-description">Beğendiğin parçaları kendi sıranla bir araya getir.</p><FeaturePlaceholder icon="playlists" title="Sana özel bir seçki" description="Çalma listelerin ve beğendiklerin burada yer alacak." availability={snapshot.availability} /></section>
  )

  return (
    <section aria-labelledby="playlists-title">
      <p className="mobile-eyebrow">HER ANA BİR LİSTE</p>
      <h1 id="playlists-title">{selected?.name ?? (selectedId ? 'Liste bulunamadı' : 'Listelerin')}</h1>
      {selectedId && !selected && <p role="status">Bu liste kaldırılmış veya başka bir kitaplığa ait olabilir. Geri dönerek listelerini görebilirsin.</p>}
      {!selectedId && (
        <>
          <p className="mobile-description">Beğendiğin parçaları kendi sıranla bir araya getir.</p>
          <button type="button" className="mobile-action-button" disabled={pending || library.folder?.access !== 'granted'} onClick={() => openDialog('create')}>Yeni liste</button>
          {!library.folder && <p>Liste oluşturmak için önce kitaplık klasörünü seç.</p>}
          <ul className="mobile-playlist-cards" aria-label="Çalma listeleri">{snapshot.playlists.map((playlist) => <li key={playlist.id}><button type="button" onClick={() => onOpen(playlist.id)}><TrackArtwork className="mobile-playlist-art" track={trackMap.get(playlist.trackIds[0])} accessible={library.folder?.access === 'granted'} /><span><strong>{playlist.name}</strong><small>{playlist.trackIds.length} parça</small><span>{playlist.description}</span></span></button></li>)}</ul>
          {!snapshot.playlists.length && <p>Henüz listen yok. İlk listeni oluşturarak başlayabilirsin.</p>}
        </>
      )}
      {selected && (
        <>
          <p className="mobile-description">{selected.description || 'Sevdiğin parçalar, senin sıranla.'}</p>
          <p>{selected.trackIds.length} parça</p>
          <div className="mobile-button-row">
            <button className="mobile-action-button" disabled={pending || !tracks.some((track) => track.access === 'available') || library.folder?.access !== 'granted'} onClick={() => { void play(false) }}>Çal</button>
            <button className="mobile-action-button" disabled={pending || tracks.length < 2 || library.folder?.access !== 'granted'} onClick={() => { void play(true) }}>Karışık çal</button>
            <button className="mobile-action-button" disabled={pending} onClick={() => openDialog('edit')}>Düzenle</button>
            <button className="mobile-action-button" disabled={pending || library.folder?.access !== 'granted'} onClick={() => openDialog('add')}>Parça ekle</button>
            <button className="mobile-action-button" disabled={pending} onClick={() => openDialog('delete')}>Listeyi sil</button>
          </div>
          {hasMissingTracks && <p role="status">Bazı parçalar mevcut kitaplıkta bulunamadı. Sıralamadan önce kitaplığı kontrol et.</p>}
          <QueueList tracks={tracks} currentTrackId={null} pending={pending || hasMissingTracks} onSelect={(trackId) => { const playable = tracks.filter((track) => track.access === 'available'); if (playable.some((track) => track.id === trackId)) void perform(() => mobilePlatform.playback.dispatch({ type: 'loadQueue', tracks: playable, startTrackId: trackId })) }} onReorder={(trackIds) => { void dispatch({ type: 'reorder', playlistId: selected.id, trackIds }) }} />
          <details className="mobile-settings-card"><summary>Listeden parça çıkar</summary><label className="mobile-form">Listede parça ara<input type="search" value={removeQuery} onChange={(event) => setRemoveQuery(event.target.value)} /></label>{removable.slice(0, 50).map((track) => <button key={track.id} className="mobile-action-button" disabled={pending} onClick={() => { void dispatch({ type: 'removeTrack', playlistId: selected.id, trackId: track.id }) }}>{track.title} çıkar</button>)}{removable.length > 50 && <p>Daha fazla parça için aramanı daralt.</p>}</details>
        </>
      )}
      {error && !dialog && <p className="mobile-error" role="alert">{error}</p>}
      {(dialog === 'create' || (dialog === 'edit' && selected)) && <PlaylistEditor key={dialog} playlist={dialog === 'edit' ? selected! : null} pending={pending} error={error} onCancel={() => setDialog(null)} onSave={(name, description) => dispatch(dialog === 'edit' ? { type: 'update', playlistId: selected!.id, name, description } : { type: 'create', libraryId: library.folder!.id, name, description })} />}
      {dialog === 'delete' && selected && <MobileDialog title="Liste silinsin mi?" busy={pending} onCancel={() => setDialog(null)}><p>“{selected.name}” listesi kaldırılacak. Ses dosyaları korunur.</p>{error && <p role="alert">{error}</p>}<button className="mobile-action-button" disabled={pending} onClick={() => { void dispatch({ type: 'delete', playlistId: selected.id }).then((saved) => { if (saved) setDialog(null) }) }}>Listeyi silmeyi onayla</button></MobileDialog>}
      {dialog === 'add' && selected && <MobileDialog title="Listeye parça ekle" busy={pending} onCancel={() => setDialog(null)}><label className="mobile-form">Parça ara<input type="search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} /></label><p>{candidates.length} uygun parça</p><ul className="mobile-picker-list">{candidates.slice(0, 50).map((track) => <li key={track.id}><button className="mobile-action-button" disabled={pending} onClick={() => { void dispatch({ type: 'addTrack', playlistId: selected.id, trackId: track.id }) }}>{track.title} ekle</button></li>)}</ul>{candidates.length > 50 && <p>Daha fazla parça için aramanı daralt.</p>}{error && <p role="alert">{error}</p>}</MobileDialog>}
    </section>
  )
}
