import { useState } from 'react'
import type { FormEvent } from 'react'
import type { MobilePlaylist } from '../../../../src/shared/mobile'
import { MobileDialog } from '../../components/MobileDialog'

export function PlaylistEditor({ playlist, pending, error, onCancel, onSave }: {
  playlist: MobilePlaylist | null
  pending: boolean
  error: string | null
  onCancel: () => void
  onSave: (name: string, description: string) => Promise<boolean>
}) {
  const [name, setName] = useState(playlist?.name ?? '')
  const [description, setDescription] = useState(playlist?.description ?? '')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || pending) return
    void onSave(name.trim(), description.trim()).then((saved) => { if (saved) onCancel() })
  }
  return (
    <MobileDialog title={playlist ? 'Listeyi düzenle' : 'Yeni liste'} busy={pending} onCancel={onCancel}>
      <form className="mobile-form" onSubmit={submit}>
        <label>Liste adı<input autoFocus value={name} maxLength={100} required disabled={pending} onChange={(event) => setName(event.target.value)} /></label>
        <label>Açıklama<textarea value={description} maxLength={1000} rows={3} disabled={pending} onChange={(event) => setDescription(event.target.value)} /></label>
        {error && <p className="mobile-error" role="alert">{error}</p>}
        <button type="submit" className="mobile-action-button" disabled={pending || !name.trim()}>{pending ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </form>
    </MobileDialog>
  )
}
