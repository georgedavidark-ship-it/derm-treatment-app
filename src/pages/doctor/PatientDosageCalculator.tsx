import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { calculateDosage } from '../../lib/dosage'
import type { CumulativeDoseOption, Drug, DosageScheme, ReleaseForm } from '../../types/drug'
import ReleaseFormEstimate from './ReleaseFormEstimate'
import CumulativeDoseReference from './CumulativeDoseReference'

interface Props {
  patientId: string
  defaultWeightKg?: number | null
}

export default function PatientDosageCalculator({ defaultWeightKg }: Props) {
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [schemes, setSchemes] = useState<DosageScheme[]>([])
  const [cumulativeOptions, setCumulativeOptions] = useState<CumulativeDoseOption[]>([])
  const [releaseForms, setReleaseForms] = useState<ReleaseForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [drugId, setDrugId] = useState('')
  const [schemeId, setSchemeId] = useState('')
  const [weight, setWeight] = useState(defaultWeightKg != null ? String(defaultWeightKg) : '')

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!drugId && drugs.length > 0) setDrugId(drugs[0].id)
  }, [drugs, drugId])

  useEffect(() => {
    const schemesForDrug = schemes.filter((s) => s.drug_id === drugId)
    if (!schemesForDrug.some((s) => s.id === schemeId)) {
      setSchemeId(schemesForDrug[0]?.id ?? '')
    }
  }, [drugId, schemes, schemeId])

  async function load() {
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

  const scheme = schemes.find((s) => s.id === schemeId)
  const weightNum = Number(weight)
  const weightValid = weight.trim() !== '' && !Number.isNaN(weightNum) && weightNum > 0
  const newDose = scheme && weightValid ? calculateDosage(weightNum, scheme.mg_per_kg) : null

  if (loading) return <p className="muted">Загрузка…</p>

  if (drugs.length === 0) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Калькулятор дозировки</h2>
        <p className="muted">
          Сначала добавьте препараты и схемы дозирования в справочнике «Препараты».
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Калькулятор дозировки</h2>
      {error && <p className="error-text">{error}</p>}
      <p className="muted" style={{ marginTop: 0 }}>
        Справочный расчёт для этого пациента, ничего не сохраняет. Чтобы оформить реальное
        назначение со схемой по неделям, используйте раздел «Назначения препарата» выше.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 200 }}>
          <label htmlFor="pdc_drug">Препарат</label>
          <select id="pdc_drug" value={drugId} onChange={(e) => setDrugId(e.target.value)}>
            {drugs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="pdc_scheme">Схема дозирования</label>
          <select id="pdc_scheme" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
            {schemes
              .filter((s) => s.drug_id === drugId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.mg_per_kg} мг/кг)
                </option>
              ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 120 }}>
          <label htmlFor="pdc_weight">Вес, кг</label>
          <input
            id="pdc_weight"
            type="number"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          {defaultWeightKg != null && (
            <span className="muted" style={{ fontSize: 12 }}>
              Из карточки пациента, можно скорректировать
            </span>
          )}
        </div>
      </div>

      {!scheme && <p className="error-text">Для этого препарата не создано ни одной схемы дозирования.</p>}

      {scheme && newDose === null && <p className="muted">Введите вес пациента.</p>}
      {scheme && newDose !== null && (
        <p>
          Расчётная дозировка нового назначения: <strong>{newDose} мг/сутки</strong>{' '}
          <span className="muted">
            ({weightNum} кг × {scheme.mg_per_kg} мг/кг)
          </span>
        </p>
      )}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
        <h3 style={{ margin: '0 0 8px' }}>Кумулятивная доза (справочно)</h3>
        <CumulativeDoseReference
          options={cumulativeOptions.filter((o) => o.drug_id === drugId)}
          weightKg={weightValid ? weightNum : null}
          dailyDoseMg={newDose}
        />
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
        <h3 style={{ margin: '0 0 8px' }}>Форма выпуска и упаковки</h3>
        <ReleaseFormEstimate
          doseMgPerDay={newDose}
          releaseForms={releaseForms.filter((f) => f.drug_id === drugId)}
        />
      </div>
    </div>
  )
}
