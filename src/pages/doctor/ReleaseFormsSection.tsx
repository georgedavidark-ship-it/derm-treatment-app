import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ReleaseForm } from '../../types/drug'

interface Props {
  drugId: string
  onChanged?: () => void
}

export default function ReleaseFormsSection({ drugId, onChanged }: Props) {
  const [forms, setForms] = useState<ReleaseForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [unitDoseMg, setUnitDoseMg] = useState('')
  const [unitsPerPackage, setUnitsPerPackage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [drugId])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('release_forms')
      .select('*')
      .eq('drug_id', drugId)
      .order('unit_dose_mg')

    if (error) setError(error.message)
    else setForms(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setEditingId(null)
    setFormName('')
    setUnitDoseMg('')
    setUnitsPerPackage('')
    setShowForm(false)
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(f: ReleaseForm) {
    setEditingId(f.id)
    setFormName(f.form_name)
    setUnitDoseMg(String(f.unit_dose_mg))
    setUnitsPerPackage(String(f.units_per_package))
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const doseNum = Number(unitDoseMg)
    const packageNum = Number(unitsPerPackage)

    if (
      !formName.trim() ||
      Number.isNaN(doseNum) ||
      doseNum <= 0 ||
      !Number.isInteger(packageNum) ||
      packageNum <= 0
    ) {
      setError(
        'Проверьте поля: доза за единицу — положительное число, штук в упаковке — целое положительное число.',
      )
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      form_name: formName.trim(),
      unit_dose_mg: doseNum,
      units_per_package: packageNum,
    }

    const result = editingId
      ? await supabase.from('release_forms').update(payload).eq('id', editingId)
      : await supabase.from('release_forms').insert({ ...payload, drug_id: drugId })

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
    if (!confirm('Удалить эту форму выпуска?')) return
    const { error } = await supabase.from('release_forms').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    load()
    onChanged?.()
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
      <div className="toolbar" style={{ marginBottom: showForm || forms.length > 0 ? 12 : 0 }}>
        <h3 style={{ margin: 0 }}>Формы выпуска</h3>
        {!showForm && (
          <button className="btn secondary" onClick={startCreate}>
            + Добавить форму
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 180 }}>
              <label htmlFor={`${drugId}-form-name`}>Форма выпуска</label>
              <input
                id={`${drugId}-form-name`}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Капсула 8 мг"
                required
              />
            </div>
            <div className="field" style={{ minWidth: 140 }}>
              <label htmlFor={`${drugId}-unit-dose`}>Доза за единицу, мг</label>
              <input
                id={`${drugId}-unit-dose`}
                type="number"
                step="0.01"
                min="0"
                value={unitDoseMg}
                onChange={(e) => setUnitDoseMg(e.target.value)}
                required
              />
            </div>
            <div className="field" style={{ minWidth: 140 }}>
              <label htmlFor={`${drugId}-units-package`}>Штук в упаковке</label>
              <input
                id={`${drugId}-units-package`}
                type="number"
                step="1"
                min="1"
                value={unitsPerPackage}
                onChange={(e) => setUnitsPerPackage(e.target.value)}
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
      {!loading && forms.length === 0 && <p className="muted">Формы выпуска не заданы.</p>}

      {!loading && forms.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Форма</th>
              <th>Мг/ед.</th>
              <th>Шт./уп.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {forms.map((f) => (
              <tr key={f.id}>
                <td>{f.form_name}</td>
                <td>{f.unit_dose_mg}</td>
                <td>{f.units_per_package}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn secondary" onClick={() => startEdit(f)}>
                    Изменить
                  </button>{' '}
                  <button className="btn danger" onClick={() => handleDelete(f.id)}>
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
