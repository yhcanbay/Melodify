const paths = {
  library: 'M4 4h4v16H4zM11 4h4v16h-4zM18 4l3 15',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  playlists: 'M4 5h16M4 10h12M4 15h8M18 13v8m-4-4h8',
  queue: 'M4 5h16M4 10h16M4 15h9M4 20h9M17 14l5 3-5 3z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  music: 'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3M20 16a3 3 0 1 1-3-3c2 0 3 1 3 3',
  back: 'M15 5l-7 7 7 7',
  play: 'M8 4l12 8-12 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
} as const

export type MobileIconName = keyof typeof paths

export function MobileIcon({ name }: { name: MobileIconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
