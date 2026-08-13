import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { SkincareRoutine } from '../../types/skincare'

interface Props {
  patientId: string
}

export default function SkincareRoutinesSection({ patientId }: Props) {
  const [routines, setRoutines] = useState<SkincareRoutine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [productsAndProcedures, setProductsAndProcedures] = useState('')
  const [instructions, setInstructions] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [patientId])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('skincare_routines')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at')

    if (error) setError(error.message)
    else setRoutines(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setEditingId(null)
    setProductsAndProcedures('')
    setInstructions('')
    setShowForm(false)
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(r: SkincareRoutine) {
    setEditingId(r.id)
    setProductsAndProcedures(r.products_and_procedures ?? '')
    setInstructions(r.instructions ?? '')
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const products = productsAndProcedures.trim()
    const instr = instructions.trim()
    if (!products && !instr) {
      setError('Укажите средство/процедуру или инструкцию.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      products_and_procedures: products || null,
      instructions: instr || null,
    }

    const result = editingId
      ? await supabase.from('skincare_routines').update(payload).eq('id', editingId)
      : await supabase.from('skincare_routines').insert({ ...payload, patient_id: patientId })

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    resetForm()
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить эту запись ухода?')) return
    const { error } = await supabase.from('skincare_routines').delete().eq('id', id)
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
        <h2 style={{ margin: 0 }}>Уход за кожей</h2>
        {!showForm && (
          <button className="btn" onClick={startCreate}>
            + Добавить запись
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
          <div className="field">
            <label htmlFor="sr_products">Средство / процедура</label>
            <textarea
              id="sr_products"
              rows={2}
              value={productsAndProcedures}
              onChange={(e) => setProductsAndProcedures(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="sr_instructions">Инструкция по применению</label>
            <textarea
              id="sr_instructions"
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
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
              <th>Средство / процедура</th>
              <th>Инструкция</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {routines.map((r) => (
              <tr key={r.id}>
                <td>{r.products_and_procedures ?? '—'}</td>
                <td className="muted">{r.instructions ?? '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn secondary" onClick={() => startEdit(r)}>
                    Изменить
                  </button>{' '}
                  <button className="btn danger" onClick={() => handleDelete(r.id)}>
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
