import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DIAGNOSIS_TYPES, type Diagnosis } from '../../types/diagnosis'

const OTHER = 'Другое'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  patientId: string
}

export default function DiagnosesSection({ patientId }: Props) {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [diagnosisType, setDiagnosisType] = useState<string>(DIAGNOSIS_TYPES[0])
  const [customType, setCustomType] = useState('')
  const [diagnosedAt, setDiagnosedAt] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [patientId])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('diagnoses')
      .select('*')
      .eq('patient_id', patientId)
      .order('diagnosed_at', { ascending: false })

    if (error) setError(error.message)
    else setDiagnoses(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setEditingId(null)
    setDiagnosisType(DIAGNOSIS_TYPES[0])
    setCustomType('')
    setDiagnosedAt(todayIso())
    setNotes('')
    setShowForm(false)
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(d: Diagnosis) {
    setEditingId(d.id)
    const known = (DIAGNOSIS_TYPES as readonly string[]).includes(d.diagnosis_type)
    if (known && d.diagnosis_type !== OTHER) {
      setDiagnosisType(d.diagnosis_type)
      setCustomType('')
    } else {
      setDiagnosisType(OTHER)
      setCustomType(d.diagnosis_type)
    }
    setDiagnosedAt(d.diagnosed_at)
    setNotes(d.notes ?? '')
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const finalType = diagnosisType === OTHER ? customType.trim() : diagnosisType
    if (!finalType) return

    setSaving(true)
    setError(null)

    const payload = {
      diagnosis_type: finalType,
      diagnosed_at: diagnosedAt,
      notes: notes.trim() || null,
    }

    const result = editingId
      ? await supabase.from('diagnoses').update(payload).eq('id', editingId)
      : await supabase.from('diagnoses').insert({ ...payload, patient_id: patientId })

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    resetForm()
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить эту запись из истории болезни?')) return
    const { error } = await supabase.from('diagnoses').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    load()
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="toolbar" style={{ marginBottom: showForm || diagnoses.length ? 16 : 0 }}>
        <h2 style={{ margin: 0 }}>История болезни</h2>
        {!showForm && (
          <button className="btn" onClick={startCreate}>
            + Добавить диагноз
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
          <div className="field">
            <label htmlFor="diagnosis_type">Тип патологии / диагноз</label>
            <select
              id="diagnosis_type"
              value={diagnosisType}
              onChange={(e) => setDiagnosisType(e.target.value)}
            >
              {DIAGNOSIS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {diagnosisType === OTHER && (
            <div className="field">
              <label htmlFor="custom_type">Укажите диагноз</label>
              <input
                id="custom_type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="diagnosed_at">Дата постановки</label>
            <input
              id="diagnosed_at"
              type="date"
              value={diagnosedAt}
              onChange={(e) => setDiagnosedAt(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="notes">Заметки врача</label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={resetForm}
              disabled={saving}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {loading && <p className="muted">Загрузка…</p>}
      {!loading && error && !showForm && <p className="error-text">{error}</p>}
      {!loading && diagnoses.length === 0 && (
        <p className="muted">Записей в истории болезни пока нет.</p>
      )}

      {!loading && diagnoses.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Диагноз</th>
              <th>Заметки</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {diagnoses.map((d) => (
              <tr key={d.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(d.diagnosed_at).toLocaleDateString('ru-RU')}
                </td>
                <td>{d.diagnosis_type}</td>
                <td className="muted">{d.notes ?? '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn secondary" onClick={() => startEdit(d)}>
                    Изменить
                  </button>{' '}
                  <button className="btn danger" onClick={() => handleDelete(d.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
