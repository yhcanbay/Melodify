import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { MobileTrack } from '../../../../src/shared/mobile'
import { LibraryTrackRow } from './LibraryTrackRow'

export function VirtualTrackList({ tracks, accessible, disabled, onPlay, resetKey }: {
  tracks: MobileTrack[]
  accessible: boolean
  disabled: boolean
  onPlay: (id: string) => void
  resetKey: string
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const fontProbe = useRef<HTMLSpanElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(400)
  const [rowHeight, setRowHeight] = useState(96)
  const start = Math.max(0, Math.min(Math.floor(scrollTop / rowHeight) - 4, tracks.length - 1))
  const end = Math.min(tracks.length, Math.ceil((scrollTop + height) / rowHeight) + 4)

  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const resize = new ResizeObserver(() => {
      setHeight(element.clientHeight)
      setRowHeight(Math.max(88, Math.ceil(parseFloat(getComputedStyle(element).fontSize) * 6)))
    })
    resize.observe(element)
    if (fontProbe.current) resize.observe(fontProbe.current)
    return () => resize.disconnect()
  }, [])

  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0
    setScrollTop(0)
  }, [resetKey])

  function navigate(event: KeyboardEvent) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-track-index]')
    const current = Number(row?.dataset.trackIndex ?? 0)
    const next = Math.max(0, Math.min(tracks.length - 1, event.key === 'Home' ? 0 : event.key === 'End' ? tracks.length - 1 : current + (event.key === 'ArrowDown' ? 1 : -1)))
    if (!viewport.current || tracks.length === 0) return
    event.preventDefault()
    const element = viewport.current
    if (next * rowHeight < element.scrollTop) element.scrollTop = next * rowHeight
    else if ((next + 1) * rowHeight > element.scrollTop + element.clientHeight) element.scrollTop = (next + 1) * rowHeight - element.clientHeight
    setScrollTop(element.scrollTop)
    requestAnimationFrame(() => element.querySelector<HTMLButtonElement>(`[data-track-index="${next}"] button`)?.focus({ preventScroll: true }))
  }

  return (
    <div ref={viewport} className="mobile-library-viewport" tabIndex={0} role="region" aria-label="Kaydırılabilir kitaplık" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} onKeyDown={navigate}>
      <span ref={fontProbe} className="mobile-font-probe" aria-hidden="true">M</span>
      <ul className="mobile-library-tracks" aria-label="Kitaplık parçaları">
        {start > 0 && <li role="presentation" aria-hidden="true" style={{ height: start * rowHeight }} />}
        {tracks.slice(start, end).map((track, offset) => (
          <LibraryTrackRow key={track.id} track={track} accessible={accessible} disabled={disabled} onPlay={() => onPlay(track.id)} index={start + offset} total={tracks.length} height={rowHeight} />
        ))}
        {end < tracks.length && <li role="presentation" aria-hidden="true" style={{ height: (tracks.length - end) * rowHeight }} />}
      </ul>
    </div>
  )
}
