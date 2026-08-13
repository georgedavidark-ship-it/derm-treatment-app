import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { calculateDosage } from '../../lib/dosage'
import type { CumulativeDoseOption, Drug, DosageScheme, ReleaseForm } from '../../types/drug'
import ReleaseFormsSection from './ReleaseFormsSection'
import ReleaseFormEstimate from './ReleaseFormEstimate'
import DosageSchemesSection from './DosageSchemesSection'
import CumulativeDoseOptionsSection from './CumulativeDoseOptionsSection'
import CumulativeDoseReference from './CumulativeDoseReference'

export default function DrugsPage() {
  const { session } = useAuth()
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [schemes, setSchemes] = useState<DosageScheme[]>([])
  const [cumulativeOptions, setCumulativeOptions] = useState<CumulativeDoseOption[]>([])
  const [releaseForms, setReleaseForms] = useState<ReleaseForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newDrugName, setNewDrugName] = useState('')
  const [creatingDrug, setCreatingDrug] = useState(false)

  const [calcDrugId, setCalcDrugId] = useState('')
  const [calcSchemeId, setCalcSchemeId] = useState('')
  const [calcWeight, setCalcWeight] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!calcDrugId && drugs.length > 0) setCalcDrugId(drugs[0].id)
  }, [drugs, calcDrugId])

  useEffect(() => {
    const schemesForDrug = schemes.filter((s) => s.drug_id === calcDrugId)
    if (!schemesForDrug.some((s) => s.id === calcSchemeId)) {
      setCalcSchemeId(schemesForDrug[0]?.id ?? '')
    }
  }, [calcDrugId, schemes, calcSchemeId])

  async function loadAll() {
    setLoading(true)
    setError(null)

    const [drugsRes, schemesRes, cumulativeRes, releaseFormsRes] = await Promise.all([
      supabase.from('drugs').select('*').order('name'),
      supabase.from('dosage_schemes').select('*'),
      supabase.from('cumulative_dose_options').select('*'),
      supabase.from('release_forms').select('*'),
    ])

    if (drugsRes.error) {
      setError(drugsRes.error.message)
      setLoading(false)
      return
    }
    if (schemesRes.error) {
      setError(schemesRes.error.message)
      setLoading(false)
      return
    }
    if (cumulativeRes.error) {
      setError(cumulativeRes.error.message)
      setLoading(false)
      return
    }
    if (releaseFormsRes.error) {
      setError(releaseFormsRes.error.message)
      setLoading(false)
      return
    }

    setDrugs(drugsRes.data ?? [])
    setSchemes(schemesRes.data ?? [])
    setCumulativeOptions(cumulativeRes.data ?? [])
    setReleaseForms(releaseFormsRes.data ?? [])
    setLoading(false)
  }

  async function handleAddDrug(e: FormEvent) {
    e.preventDefault()
    if (!newDrugName.trim() || !session) return
    setCreatingDrug(true)
    setError(null)
    const { error } = await supabase
      .from('drugs')
      .insert({ name: newDrugName.trim(), doctor_id: session.user.id })
    setCreatingDrug(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewDrugName('')
    loadAll()
  }

  async function handleDeleteDrug(id: string) {
    if (!confirm('Удалить препарат вместе со схемами дозирования и вариантами кумулятивной дозы?')) return
    const { error } = await supabase.from('drugs').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    loadAll()
  }

  const calcScheme = schemes.find((s) => s.id === calcSchemeId)
  const calcWeightNum = Number(calcWeight)
  const calcWeightValid = calcWeight.trim() !== '' && !Number.isNaN(calcWeightNum) && calcWeightNum > 0
  const calcResult = calcScheme && calcWeightValid ? calculateDosage(calcWeightNum, calcScheme.mg_per_kg) : null

  if (loading) return <p className="muted">Загрузка…</p>

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Справочник препаратов</h1>
      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Новый препарат</h2>
        <form onSubmit={handleAddDrug} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="new_drug_name">Название</label>
            <input
              id="new_drug_name"
              value={newDrugName}
              onChange={(e) => setNewDrugName(e.target.value)}
              placeholder="Например, Аспирин Х"
              required
            />
          </div>
          <button className="btn" type="submit" disabled={creatingDrug}>
            {creatingDrug ? 'Добавляем…' : 'Добавить'}
          </button>
        </form>
      </div>

      {drugs.length === 0 && (
        <p className="muted">Препаратов пока нет — добавьте первый выше.</p>
      )}

      {drugs.map((drug) => (
        <div className="card" style={{ marginBottom: 16 }} key={drug.id}>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <h2 style={{ margin: 0 }}>{drug.name}</h2>
            <button className="btn danger" onClick={() => handleDeleteDrug(drug.id)}>
              Удалить препарат
            </button>
          </div>

          <DosageSchemesSection drugId={drug.id} onChanged={loadAll} />
          <CumulativeDoseOptionsSection drugId={drug.id} onChanged={loadAll} />
          <ReleaseFormsSection drugId={drug.id} onChanged={loadAll} />
        </div>
      ))}

      {drugs.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Калькулятор дозировки</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Справочный расчёт по сохранённым схемам. Итоговое назначение с фиксацией дозировки
            и разбивкой по неделям выполняется в карточке пациента.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor="calc_drug">Препарат</label>
              <select
                id="calc_drug"
                value={calcDrugId}
                onChange={(e) => setCalcDrugId(e.target.value)}
              >
                {drugs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ minWidth: 220 }}>
              <label htmlFor="calc_scheme">Схема дозирования</label>
              <select
                id="calc_scheme"
                value={calcSchemeId}
                onChange={(e) => setCalcSchemeId(e.target.value)}
              >
                {schemes
                  .filter((s) => s.drug_id === calcDrugId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.mg_per_kg} мг/кг)
                    </option>
                  ))}
              </select>
            </div>
            <div className="field" style={{ minWidth: 120 }}>
              <label htmlFor="calc_weight">Вес, кг</label>
              <input
                id="calc_weight"
                type="number"
                step="0.1"
                min="0"
                value={calcWeight}
                onChange={(e) => setCalcWeight(e.target.value)}
              />
            </div>
          </div>

          {!calcScheme && (
            <p className="error-text">Для этого препарата не создано ни одной схемы дозирования.</p>
          )}

          {calcScheme && calcResult === null && (
            <p className="muted">Введите вес пациента, чтобы увидеть расчёт.</p>
          )}
          {calcScheme && calcResult !== null && (
            <p>
              Итоговая дозировка: <strong>{calcResult} мг/сутки</strong>{' '}
              <span className="muted">
                ({calcWeightNum} кг × {calcScheme.mg_per_kg} мг/кг)
              </span>
            </p>
          )}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: '0 0 8px' }}>Кумулятивная доза (справочно)</h3>
            <CumulativeDoseReference
              options={cumulativeOptions.filter((o) => o.drug_id === calcDrugId)}
              weightKg={calcWeightValid ? calcWeightNum : null}
              dailyDoseMg={calcResult}
            />
          </div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: '0 0 8px' }}>Форма выпуска и упаковки</h3>
            <ReleaseFormEstimate
              doseMgPerDay={calcResult}
              releaseForms={releaseForms.filter((f) => f.drug_id === calcDrugId)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
