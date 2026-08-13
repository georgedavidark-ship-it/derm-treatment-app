import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { PrescriptionWeek } from '../../types/prescription'

interface Props {
  prescriptionId: string
}

interface RowEdits {
  dosage: string
  comment: string
}

export default function PrescriptionWeeksEditor({ prescriptionId }: Props) {
  const [weeks, setWeeks] = useState<PrescriptionWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, RowEdits>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [addingWeek, setAddingWeek] = useState(false)

  useEffect(() => {
    load()
  }, [prescriptionId])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('prescription_weeks')
      .select('*')
      .eq('prescription_id', prescriptionId)
      .order('week_number')

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const nextWeeks: PrescriptionWeek[] = data ?? []
    setWeeks(nextWeeks)
    setEdits(
      Object.fromEntries(
        nextWeeks.map((w) => [w.id, { dosage: String(w.dosage), comment: w.comment ?? '' }]),
      ),
    )
    setLoading(false)
  }

  function updateEdit(id: string, patch: Partial<RowEdits>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function handleSaveWeek(week: PrescriptionWeek) {
    const edit = edits[week.id]
    const num = Number(edit.dosage)
    if (Number.isNaN(num) || num < 0) {
      setError('Дозировка недели должна быть неотрицательным числом.')
      return
    }

    setSavingId(week.id)
    setError(null)
    const { error } = await supabase
      .from('prescription_weeks')
      .update({ dosage: num, comment: edit.comment.trim() || null })
      .eq('id', week.id)
    setSavingId(null)

    if (error) {
      setError(error.message)
      return
    }
    load()
  }

  async function handleDeleteWeek(id: string) {
    if (!confirm('Удалить эту неделю из схемы?')) return
    const { error } = await supabase.from('prescription_weeks').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    load()
  }

  async function handleAddWeek() {
    const lastWeek = weeks[weeks.length - 1]
    setAddingWeek(true)
    setError(null)
    const { error } = await supabase.from('prescription_weeks').insert({
      prescription_id: prescriptionId,
      week_number: lastWeek ? lastWeek.week_number + 1 : 1,
      dosage: lastWeek ? lastWeek.dosage : 0,
      comment: null,
    })
    setAddingWeek(false)
    if (error) {
      setError(error.message)
      return
    }
    load()
  }

  if (loading) return <p className="muted">Загрузка схемы…</p>

  return (
    <div style={{ marginTop: 12 }}>
      {error && <p className="error-text">{error}</p>}
      {weeks.length === 0 && <p className="muted">Недель в схеме нет.</p>}

      {weeks.length > 0 && (
        <table>
          <thead>
            <tr>
              <th style={{ width: 70 }}>Неделя</th>
              <th style={{ width: 140 }}>Дозировка, мг</th>
              <th>Комментарий</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const edit = edits[w.id] ?? { dosage: String(w.dosage), comment: w.comment ?? '' }
              return (
                <tr key={w.id}>
                  <td>{w.week_number}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={edit.dosage}
                      onChange={(e) => updateEdit(w.id, { dosage: e.target.value })}
                      style={{ width: 100, padding: '4px 6px' }}
                    />
                  </td>
                  <td>
                    <input
                      value={edit.comment}
                      onChange={(e) => updateEdit(w.id, { comment: e.target.value })}
                      placeholder="—"
                      style={{ width: '100%', padding: '4px 6px' }}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn secondary"
                      onClick={() => handleSaveWeek(w)}
                      disabled={savingId === w.id}
                    >
                      {savingId === w.id ? 'Сохраняем…' : 'Сохранить'}
                    </button>{' '}
                    <button className="btn danger" onClick={() => handleDeleteWeek(w.id)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <button className="btn secondary" style={{ marginTop: 10 }} onClick={handleAddWeek} disabled={addingWeek}>
        {addingWeek ? 'Добавляем…' : '+ Добавить неделю'}
      </button>
    </div>
  )
}
