import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { CumulativeDoseOption } from '../../types/drug'

interface Props {
  drugId: string
  onChanged?: () => void
}

export default function CumulativeDoseOptionsSection({ drugId, onChanged }: Props) {
  const [options, setOptions] = useState<CumulativeDoseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [maxMgPerKg, setMaxMgPerKg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [drugId])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('cumulative_dose_options')
      .select('*')
      .eq('drug_id', drugId)
      .order('name')

    if (error) setError(error.message)
    else setOptions(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setMaxMgPerKg('')
    setShowForm(false)
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(o: CumulativeDoseOption) {
    setEditingId(o.id)
    setName(o.name)
    setMaxMgPerKg(String(o.max_cumulative_dose_mg_per_kg))
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const maxNum = Number(maxMgPerKg)

    if (!name.trim() || Number.isNaN(maxNum) || maxNum <= 0) {
      setError('Проверьте поля: название обязательно, доза — положительное число (мг/кг за курс).')
      return
    }

    setSaving(true)
    setError(null)

    const payload = { name: name.trim(), max_cumulative_dose_mg_per_kg: maxNum }

    const result = editingId
      ? await supabase.from('cumulative_dose_options').update(payload).eq('id', editingId)
      : await supabase.from('cumulative_dose_options').insert({ ...payload, drug_id: drugId })

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    resetForm()
    load()
    onChanged?.()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить этот вариант кумулятивной дозы?')) return
    const { error } = await supabase.from('cumulative_dose_options').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    load()
    onChanged?.()
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
      <div className="toolbar" style={{ marginBottom: showForm || options.length > 0 ? 12 : 0 }}>
        <h3 style={{ margin: 0 }}>Варианты кумулятивной дозы</h3>
        {!showForm && (
          <button className="btn secondary" onClick={startCreate}>
            + Добавить вариант
          </button>
        )}
      </div>

      <p className="muted" style={{ marginTop: 0, marginBottom: showForm || options.length > 0 ? 12 : 0 }}>
        Справочные цифры для ориентира при расчёте длительности курса — не привязаны к конкретной
        схеме дозирования и не блокируют создание назначения.
      </p>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 220 }}>
              <label htmlFor={`${drugId}-cumdose-name`}>Название варианта</label>
              <input
                id={`${drugId}-cumdose-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, короткий курс"
                required
              />
            </div>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor={`${drugId}-cumdose-max`}>Кумулятивная доза, мг/кг за курс</label>
              <input
                id={`${drugId}-cumdose-max`}
                type="number"
                step="0.01"
                min="0"
                value={maxMgPerKg}
                onChange={(e) => setMaxMgPerKg(e.target.value)}
                required
              />
            </div>
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

      {loading && <p className="muted">Загрузка…</p>}
      {!loading && !showForm && error && <p className="error-text">{error}</p>}
      {!loading && options.length === 0 && <p className="muted">Варианты кумулятивной дозы не заданы.</p>}

      {!loading && options.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Мг/кг за курс</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {options.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{o.max_cumulative_dose_mg_per_kg}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn secondary" onClick={() => startEdit(o)}>
                    Изменить
                  </button>{' '}
                  <button className="btn danger" onClick={() => handleDelete(o.id)}>
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
