import type { HTMLAttributes, ReactNode } from 'react'

// Local, dependency-free interpretations of the React Bits Spotlight Card,
// Gradient Text and Grainient patterns. See DESIGN.md for the references.
export function SpotlightCard({
  as: Surface = 'div',
  className = '',
  onPointerMove,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'article' }) {
  return (
    <Surface
      {...props}
      className={`spotlight-card ${className}`}
      onPointerMove={(event) => {
        if (event.pointerType !== 'touch') {
          const bounds = event.currentTarget.getBoundingClientRect()
          event.currentTarget.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`)
          event.currentTarget.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`)
        }
        onPointerMove?.(event)
      }}
    />
  )
}

export function GradientText({ children }: { children: ReactNode }) {
  return <span className="gradient-text">{children}</span>
}

export function GrainField() {
  return <span className="grain-field" aria-hidden="true"><span /><span /></span>
}

// CSS/SVG backgrounds inspired by React Bits Dark Veil, Aurora and Floating Lines.
// Only the selected background is displayed; the layers never intercept input.
export function AmbientBackdrop() {
  return (
    <div className="ambient-backdrop" aria-hidden="true">
      <div className="ambient-mode ambient-aurora"><span /><span /></div>
      <div className="ambient-mode ambient-veil"><span /><span /></div>
      <svg className="ambient-mode ambient-lines" viewBox="0 0 1600 1000" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id="melodify-ambient-lines" x1="0" y1="0" x2="1600" y2="1000" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9573cb" stopOpacity="0" />
            <stop offset="0.35" stopColor="#bca2e5" />
            <stop offset="0.75" stopColor="#b982a3" />
            <stop offset="1" stopColor="#df9d80" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 16 }, (_, index) => (
          <path
            key={index}
            d={`M-120 ${80 + index * 22} C220 ${-80 + index * 14} 430 ${740 + index * 10} 790 ${510 + index * 16} S1280 ${350 + index * 22} 1720 ${700 + index * 14}`}
            stroke="url(#melodify-ambient-lines)"
            strokeWidth="1.2"
          />
        ))}
      </svg>
      <div className="ambient-texture" />
    </div>
  )
}
