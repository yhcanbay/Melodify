import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { MobileTrack } from '../../../../src/shared/mobile'

type Drag = { from: number; target: number; pointerId: number; ids: string[] }

export function QueueList({ tracks, currentTrackId, pending, onSelect, onReorder }: {
  tracks: MobileTrack[]
  currentTrackId: string | null
  pending: boolean
  onSelect: (id: string) => void
  onReorder: (ids: string[]) => void
}) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const activeDrag = useRef<Drag | null>(null)
  const [requestedPage, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(tracks.length / 50))
  const page = Math.min(requestedPage, pageCount - 1)
  const startIndex = page * 50
  const endIndex = Math.min(tracks.length, startIndex + 50)

  function move(index: number, direction: number) {
    const ids = tracks.map((track) => track.id)
    const other = index + direction
    ;[ids[index], ids[other]] = [ids[other], ids[index]]
    onReorder(ids)
  }

  function start(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (pending || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = { from: index, target: index, pointerId: event.pointerId, ids: tracks.map((track) => track.id) }
    activeDrag.current = next
    setDrag(next)
  }

  function hover(event: PointerEvent<HTMLElement>) {
    const active = activeDrag.current
    if (!active || active.pointerId !== event.pointerId) return
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-queue-index]')
    if (row) {
      const rect = row.getBoundingClientRect()
      const target = Number(row.dataset.queueIndex) + (event.clientY > rect.top + rect.height / 2 ? 1 : 0)
      const next = { ...active, target }
      activeDrag.current = next
      setDrag(next)
    }
    const content = event.currentTarget.closest('.mobile-content')
    const bounds = content?.getBoundingClientRect()
    if (bounds) {
      if (event.clientY < bounds.top + 64) content?.scrollBy(0, -24)
      if (event.clientY > bounds.bottom - 64) content?.scrollBy(0, 24)
    }
  }

  function finish(event: PointerEvent<HTMLElement>, canceled = false) {
    const active = activeDrag.current
    if (!active || active.pointerId !== event.pointerId) return
    activeDrag.current = null
    setDrag(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (canceled || active.ids.some((id, index) => tracks[index]?.id !== id) || active.ids.length !== tracks.length) return
    const ids = [...active.ids]
    const [id] = ids.splice(active.from, 1)
    const target = active.target > active.from ? active.target - 1 : active.target
    ids.splice(target, 0, id)
    if (ids.some((value, index) => active.ids[index] !== value)) onReorder(ids)
  }

  return (
    <>
      <span className="mobile-sr-only" role="status">{drag ? `${tracks[drag.from]?.title}, hedef sıra ${Math.min(tracks.length, drag.target + 1)}` : ''}</span>
      {pageCount > 1 && <nav className="mobile-button-row" aria-label="Sıra sayfaları"><button className="mobile-action-button" disabled={pending || !!drag || page === 0} onClick={() => setPage(page - 1)}>Önceki sayfa</button><span role="status">{page + 1} / {pageCount}</span><button className="mobile-action-button" disabled={pending || !!drag || page === pageCount - 1} onClick={() => setPage(page + 1)}>Sonraki sayfa</button>{currentTrackId && <button className="mobile-action-button" onClick={() => setPage(Math.floor(Math.max(0, tracks.findIndex((track) => track.id === currentTrackId)) / 50))}>Çalan parçaya git</button>}</nav>}
      <ol className="mobile-queue-list" aria-label="Çalma sırası" onPointerMove={hover} onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)}>
        {tracks.slice(startIndex, endIndex).map((track, offset) => {
          const index = startIndex + offset
          return <li key={track.id} data-queue-index={index} aria-setsize={tracks.length} aria-posinset={index + 1} data-drop-target={drag?.target === index || (index === endIndex - 1 && drag?.target === endIndex) ? 'true' : undefined} aria-current={track.id === currentTrackId ? 'true' : undefined}>
            <div className="mobile-queue-row"><button className="mobile-queue-track" disabled={pending} onClick={() => onSelect(track.id)}>{track.title}</button><button className="mobile-icon-button mobile-drag-handle" disabled={pending} aria-label={`${track.title} sıralamak için sürükle`} onPointerDown={(event) => start(event, index)} onLostPointerCapture={(event) => finish(event, true)}>☰</button></div>
            <div><button className="mobile-action-button" aria-label={`${track.title} yukarı taşı`} disabled={pending || index === 0} onClick={() => move(index, -1)}>↑</button><button className="mobile-action-button" aria-label={`${track.title} aşağı taşı`} disabled={pending || index === tracks.length - 1} onClick={() => move(index, 1)}>↓</button></div>
          </li>
        })}
      </ol>
    </>
  )
}
