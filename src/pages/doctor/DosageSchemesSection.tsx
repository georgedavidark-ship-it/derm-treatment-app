import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { DosageScheme } from '../../types/drug'

interface Props {
  drugId: string
  onChanged?: () => void
}

export default function DosageSchemesSection({ drugId, onChanged }: Props) {
  const [schemes, setSchemes] = useState<DosageScheme[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [mgPerKg, setMgPerKg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [drugId])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('dosage_schemes')
      .select('*')
      .eq('drug_id', drugId)
      .order('name')

    if (error) setError(error.message)
    else setSchemes(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setMgPerKg('')
    setShowForm(false)
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(s: DosageScheme) {
    setEditingId(s.id)
    setName(s.name)
    setMgPerKg(String(s.mg_per_kg))
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const mgPerKgNum = Number(mgPerKg)

    if (!name.trim() || Number.isNaN(mgPerKgNum) || mgPerKgNum <= 0) {
      setError('Проверьте поля: название обязательно, доза — положительное число (мг/кг/сутки).')
      return
    }

    setSaving(true)
    setError(null)

    const payload = { name: name.trim(), mg_per_kg: mgPerKgNum }

    const result = editingId
      ? await supabase.from('dosage_schemes').update(payload).eq('id', editingId)
      : await supabase.from('dosage_schemes').insert({ ...payload, drug_id: drugId })

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
    if (!confirm('Удалить эту схему дозирования? Назначения, созданные на её основе, сохранятся.')) return
    const { error } = await supabase.from('dosage_schemes').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    load()
    onChanged?.()
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
      <div className="toolbar" style={{ marginBottom: showForm || schemes.length > 0 ? 12 : 0 }}>
        <h3 style={{ margin: 0 }}>Схемы дозирования</h3>
        {!showForm && (
          <button className="btn secondary" onClick={startCreate}>
            + Добавить схему
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 220 }}>
              <label htmlFor={`${drugId}-scheme-name`}>Название схемы</label>
              <input
                id={`${drugId}-scheme-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, стандартная"
                required
              />
            </div>
            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor={`${drugId}-scheme-mg-per-kg`}>Доза, мг/кг/сутки</label>
              <input
                id={`${drugId}-scheme-mg-per-kg`}
                type="number"
                step="0.01"
                min="0"
                value={mgPerKg}
                onChange={(e) => setMgPerKg(e.target.value)}
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
      {!loading && schemes.length === 0 && <p className="muted">Схемы дозирования не заданы.</p>}

      {!loading && schemes.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Мг/кг/сутки</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schemes.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.mg_per_kg}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn secondary" onClick={() => startEdit(s)}>
                    Изменить
                  </button>{' '}
                  <button className="btn danger" onClick={() => handleDelete(s.id)}>
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
