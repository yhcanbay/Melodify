import { useState } from 'react'

export function RangeControl({ label, value, min = 0, max, step = 1, disabled, onCommit }: {
  label: string
  value: number
  min?: number
  max: number
  step?: number
  disabled?: boolean
  onCommit: (value: number) => Promise<void>
}) {
  const [draft, setDraft] = useState<number | null>(null)
  const [committing, setCommitting] = useState(false)

  async function commit(next: number) {
    if (draft === null || committing) return
    setCommitting(true)
    try { await onCommit(next) }
    finally { setDraft(null); setCommitting(false) }
  }

  return <input aria-label={label} type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, draft ?? value))} disabled={disabled || committing} onPointerDown={(event) => setDraft(Number(event.currentTarget.value))} onChange={(event) => setDraft(Number(event.target.value))} onPointerUp={(event) => { void commit(Number(event.currentTarget.value)) }} onKeyUp={(event) => { void commit(Number(event.currentTarget.value)) }} onBlur={(event) => { void commit(Number(event.currentTarget.value)) }} onPointerCancel={() => setDraft(null)} />
}
