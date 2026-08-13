import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { PatientPhoto } from '../../types/photo'

const BUCKET = 'patient-photos'
const SIGNED_URL_TTL_SECONDS = 60 * 60

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

interface Props {
  patientId: string
}

export default function PatientPhotosSection({ patientId }: Props) {
  const [photos, setPhotos] = useState<PatientPhoto[]>([])
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [patientId])

  async function load() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('patient_photos')
      .select('*')
      .eq('patient_id', patientId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const rows: PatientPhoto[] = data ?? []
    setPhotos(rows)

    const urlEntries = await Promise.all(
      rows.map(async (p) => {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(p.storage_path, SIGNED_URL_TTL_SECONDS)
        return [p.id, signed?.signedUrl ?? ''] as const
      }),
    )
    setSignedUrls(Object.fromEntries(urlEntries))
    setLoading(false)
  }

  function resetForm() {
    setFile(null)
    setNote('')
    setShowForm(false)
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Выберите файл фото.')
      return
    }

    setUploading(true)
    setError(null)

    const path = `${patientId}/${Date.now()}-${sanitizeFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)

    if (uploadError) {
      setUploading(false)
      setError(uploadError.message)
      return
    }

    const { error: insertError } = await supabase.from('patient_photos').insert({
      patient_id: patientId,
      storage_path: path,
      note: note.trim() || null,
      uploaded_by: 'doctor',
    })

    setUploading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    resetForm()
    load()
  }

  async function handleDelete(photo: PatientPhoto) {
    if (!confirm('Удалить это фото?')) return
    setDeletingId(photo.id)
    setError(null)

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([photo.storage_path])
    if (removeError) {
      setDeletingId(null)
      setError(removeError.message)
      return
    }

    const { error: deleteError } = await supabase.from('patient_photos').delete().eq('id', photo.id)
    setDeletingId(null)

    if (deleteError) {
      setError(deleteError.message)
      return
    }
    load()
  }

  if (loading) return <p className="muted">Загрузка…</p>

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="toolbar" style={{ marginBottom: showForm || photos.length ? 16 : 0 }}>
        <h2 style={{ margin: 0 }}>Фото</h2>
        {!showForm && (
          <button className="btn" onClick={() => setShowForm(true)}>
            + Загрузить фото
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleUpload} style={{ marginBottom: 20 }}>
          <div className="field">
            <label htmlFor="photo_file">Файл</label>
            <input
              id="photo_file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="photo_note">Заметка (необязательно)</label>
            <input
              id="photo_note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Например: неделя 3"
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" type="submit" disabled={uploading}>
              {uploading ? 'Загружаем…' : 'Загрузить'}
            </button>
            <button className="btn secondary" type="button" onClick={resetForm} disabled={uploading}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {!showForm && error && <p className="error-text">{error}</p>}
      {!showForm && photos.length === 0 && <p className="muted">Фото пока нет.</p>}

      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ width: 180 }}>
              {signedUrls[p.id] ? (
                <img
                  src={signedUrls[p.id]}
                  alt={p.note ?? 'Фото пациента'}
                  style={{
                    width: 180,
                    height: 180,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 180,
                    height: 180,
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  className="muted"
                >
                  Нет доступа
                </div>
              )}
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                {new Date(p.uploaded_at).toLocaleDateString('ru-RU')} ·{' '}
                {p.uploaded_by === 'doctor' ? 'Врач' : 'Пациент'}
              </p>
              {p.note && <p style={{ margin: '2px 0' }}>{p.note}</p>}
              <button
                className="btn danger"
                style={{ marginTop: 6, padding: '4px 10px' }}
                onClick={() => handleDelete(p)}
                disabled={deletingId === p.id}
              >
                {deletingId === p.id ? 'Удаляем…' : 'Удалить'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
