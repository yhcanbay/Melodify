import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export function MobileDialog({ title, children, busy, onCancel }: { title: string; children: ReactNode; busy: boolean; onCancel: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => { dialog?.close(); previousFocus?.focus() }
  }, [])

  return <dialog ref={dialogRef} className="mobile-dialog" aria-labelledby="mobile-dialog-title" aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}><h2 id="mobile-dialog-title">{title}</h2>{children}<button type="button" className="mobile-action-button" disabled={busy} onClick={onCancel}>Vazgeç</button></dialog>
}
