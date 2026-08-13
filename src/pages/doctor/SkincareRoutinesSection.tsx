import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Drug } from '../../types/drug'
import type { Prescription } from '../../types/prescription'
import type { SkincareRoutine } from '../../types/skincare'

type RoutineMode = 'same' | 'weekly'

interface WeeklyEntry {
  products: string
  instructions: string
}

interface RowEdits {
  products: string
  instructions: string
}

interface Props {
  patientId: string
}

export default function SkincareRoutinesSection({ patientId }: Props) {
  const [routines, setRoutines] = useState<SkincareRoutine[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [prescriptionId, setPrescriptionId] = useState('')
  const [durationWeeks, setDurationWeeks] = useState('4')
  const [mode, setMode] = useState<RoutineMode>('same')
  const [sameProducts, setSameProducts] = useState('')
  const [sameInstructions, setSameInstructions] = useState('')
  const [weeklyEntries, setWeeklyEntries] = useState<WeeklyEntry[]>([])
  const [saving, setSaving] = useState(false)

  const [edits, setEdits] = useState<Record<string, RowEdits>>({})
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [addingWeek, setAddingWeek] = useState(false)

  useEffect(() => {
    load()
  }, [patientId])

  async function load() {
    setLoading(true)
    setError(null)

    const [routinesRes, prescriptionsRes, drugsRes] = await Promise.all([
      supabase
        .from('skincare_routines')
        .select('*')
        .eq('patient_id', patientId)
        .order('week_number'),
      supabase
        .from('prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .order('start_date', { ascending: false }),
      supabase.from('drugs').select('*'),
    ])

    if (routinesRes.error) {
      setError(routinesRes.error.message)
      setLoading(false)
      return
    }
    if (prescriptionsRes.error) {
      setError(prescriptionsRes.error.message)
      setLoading(false)
      return
    }
    if (drugsRes.error) {
      setError(drugsRes.error.message)
      setLoading(false)
      return
    }

    const nextRoutines: SkincareRoutine[] = routinesRes.data ?? []
    setRoutines(nextRoutines)
    setEdits(
      Object.fromEntries(
        nextRoutines.map((r) => [
          r.id,
          { products: r.products_and_procedures ?? '', instructions: r.instructions ?? '' },
        ]),
      ),
    )
    setPrescriptions(prescriptionsRes.data ?? [])
    setDrugs(drugsRes.data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setPrescriptionId('')
    setDurationWeeks('4')
    setMode('same')
    setSameProducts('')
    setSameInstructions('')
    setWeeklyEntries([])
    setShowForm(false)
  }

  useEffect(() => {
    if (mode !== 'weekly') return
    const n = Math.max(0, Math.floor(Number(durationWeeks)) || 0)
    setWeeklyEntries((prev) => {
      const next = prev.slice(0, n)
      while (next.length < n) next.push({ products: '', instructions: '' })
      return next
    })
  }, [durationWeeks, mode])

  function updateWeeklyEntry(index: number, patch: Partial<WeeklyEntry>) {
    setWeeklyEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }

  function updateEdit(id: string, patch: Partial<RowEdits>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  function drugName(drugId: string) {
    return drugs.find((d) => d.id === drugId)?.name ?? '—'
  }

  function prescriptionLabel(id: string | null) {
    if (!id) return '—'
    const p = prescriptions.find((x) => x.id === id)
    if (!p) return '—'
    return `${drugName(p.drug_id)} (с ${new Date(p.start_date).toLocaleDateString('ru-RU')})`
  }

  const durationNum = Number(durationWeeks)
  const durationValid = Number.isInteger(durationNum) && durationNum > 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!durationValid) {
      setError('Длительность должна быть целым числом недель больше нуля.')
      return
    }

    let weeksPayload: { products_and_procedures: string | null; instructions: string | null }[]
    if (mode === 'same') {
      const products = sameProducts.trim() || null
      const instructions = sameInstructions.trim() || null
      weeksPayload = Array.from({ length: durationNum }, () => ({
        products_and_procedures: products,
        instructions,
      }))
    } else {
      if (weeklyEntries.length !== durationNum) {
        setError('Заполните уход для каждой недели.')
        return
      }
      weeksPayload = weeklyEntries.map((entry) => ({
        products_and_procedures: entry.products.trim() || null,
        instructions: entry.instructions.trim() || null,
      }))
    }

    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('skincare_routines').insert(
      weeksPayload.map((w, i) => ({
        patient_id: patientId,
        prescription_id: prescriptionId || null,
        week_number: i + 1,
        ...w,
      })),
    )

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    resetForm()
    load()
  }

  async function handleSaveRow(routine: SkincareRoutine) {
    const edit = edits[routine.id]
    setSavingRowId(routine.id)
    setError(null)
    const { error } = await supabase
      .from('skincare_routines')
      .update({
        products_and_procedures: edit.products.trim() || null,
        instructions: edit.instructions.trim() || null,
      })
      .eq('id', routine.id)
    setSavingRowId(null)

    if (error) {
      setError(error.message)
      return
    }
    load()
  }

  async function handleDeleteRow(id: string) {
    if (!confirm('Удалить эту неделю ухода?')) return
    const { error } = await supabase.from('skincare_routines').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    load()
  }

  async function handleAddWeek() {
    const lastWeek = routines[routines.length - 1]
    setAddingWeek(true)
    setError(null)
    const { error } = await supabase.from('skincare_routines').insert({
      patient_id: patientId,
      prescription_id: null,
      week_number: lastWeek ? lastWeek.week_number + 1 : 1,
      products_and_procedures: null,
      instructions: null,
    })
    setAddingWeek(false)
    if (error) {
      setError(error.message)
      return
    }
    load()
  }

  if (loading) return <p className="muted">Загрузка…</p>

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="toolbar" style={{ marginBottom: showForm || routines.length ? 16 : 0 }}>
        <h2 style={{ margin: 0 }}>Уход за кожей по неделям</h2>
        {!showForm && (
          <button className="btn" onClick={() => setShowForm(true)}>
            + Назначить уход
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 220 }}>
              <label htmlFor="sr_prescription">Назначение препарата (необязательно)</label>
              <select
                id="sr_prescription"
                value={prescriptionId}
                onChange={(e) => setPrescriptionId(e.target.value)}
              >
                <option value="">Не привязано</option>
                {prescriptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {prescriptionLabel(p.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor="sr_duration">Длительность, недель</label>
              <input
                id="sr_duration"
                type="number"
                step="1"
                min="1"
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label style={{ display: 'block', marginBottom: 6 }}>Схема ухода по неделям</label>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'normal' }}>
                <input
                  type="radio"
                  name="routine_mode"
                  checked={mode === 'same'}
                  onChange={() => setMode('same')}
                />
                Одинаковый уход на весь курс
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'normal' }}>
                <input
                  type="radio"
                  name="routine_mode"
                  checked={mode === 'weekly'}
                  onChange={() => setMode('weekly')}
                />
                Разный уход по неделям
              </label>
            </div>
          </div>

          {mode === 'same' && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 240 }}>
                <label htmlFor="sr_same_products">Средства и процедуры</label>
                <textarea
                  id="sr_same_products"
                  rows={3}
                  value={sameProducts}
                  onChange={(e) => setSameProducts(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 240 }}>
                <label htmlFor="sr_same_instructions">Инструкции</label>
                <textarea
                  id="sr_same_instructions"
                  rows={3}
                  value={sameInstructions}
                  onChange={(e) => setSameInstructions(e.target.value)}
                />
              </div>
            </div>
          )}

          {mode === 'weekly' && weeklyEntries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {weeklyEntries.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ width: 90, paddingTop: 24, fontWeight: 600 }}>Неделя {i + 1}</div>
                  <div className="field" style={{ flex: 1, minWidth: 220 }}>
                    <label style={{ fontSize: 13 }}>Средства и процедуры</label>
                    <input
                      value={entry.products}
                      onChange={(e) => updateWeeklyEntry(i, { products: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px' }}
                    />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 220 }}>
                    <label style={{ fontSize: 13 }}>Инструкции</label>
                    <input
                      value={entry.instructions}
                      onChange={(e) => updateWeeklyEntry(i, { instructions: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить схему ухода'}
            </button>
            <button className="btn secondary" type="button" onClick={resetForm} disabled={saving}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {!showForm && error && <p className="error-text">{error}</p>}
      {!showForm && routines.length === 0 && <p className="muted">Уход за кожей ещё не назначен.</p>}

      {routines.length > 0 && (
        <table>
          <thead>
            <tr>
              <th style={{ width: 70 }}>Неделя</th>
              <th style={{ width: 200 }}>Назначение</th>
              <th>Средства и процедуры</th>
              <th>Инструкции</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {routines.map((r) => {
              const edit = edits[r.id] ?? {
                products: r.products_and_procedures ?? '',
                instructions: r.instructions ?? '',
              }
              return (
                <tr key={r.id}>
                  <td>{r.week_number}</td>
                  <td className="muted">{prescriptionLabel(r.prescription_id)}</td>
                  <td>
                    <input
                      value={edit.products}
                      onChange={(e) => updateEdit(r.id, { products: e.target.value })}
                      style={{ width: '100%', padding: '4px 6px' }}
                    />
                  </td>
                  <td>
                    <input
                      value={edit.instructions}
                      onChange={(e) => updateEdit(r.id, { instructions: e.target.value })}
                      style={{ width: '100%', padding: '4px 6px' }}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn secondary"
                      onClick={() => handleSaveRow(r)}
                      disabled={savingRowId === r.id}
                    >
                      {savingRowId === r.id ? 'Сохраняем…' : 'Сохранить'}
                    </button>{' '}
                    <button className="btn danger" onClick={() => handleDeleteRow(r.id)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {routines.length > 0 && (
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={handleAddWeek} disabled={addingWeek}>
          {addingWeek ? 'Добавляем…' : '+ Добавить неделю'}
        </button>
      )}
    </div>
  )
}
