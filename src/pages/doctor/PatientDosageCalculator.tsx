import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { calculateCourseDurationWeeks, calculateDosage, midpoint } from '../../lib/dosage'
import { SEVERITIES, type Drug, type DosageRule, type ReleaseForm, type Severity } from '../../types/drug'
import ReleaseFormEstimate from './ReleaseFormEstimate'
import MgPerKgSlider from './MgPerKgSlider'

interface PrescribedWeekRow {
  dosage: number
  // prescription_weeks -> prescriptions — связь многие-к-одному (у каждой
  // недели ровно одно назначение), поэтому PostgREST возвращает embed как
  // один объект, а не массив, несмотря на то что нетипизированный клиент
  // supabase-js статически выводит здесь тип массива.
  prescriptions: { drug_id: string } | null
}

interface Props {
  patientId: string
  defaultWeightKg?: number | null
}

export default function PatientDosageCalculator({ patientId, defaultWeightKg }: Props) {
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [rules, setRules] = useState<DosageRule[]>([])
  const [releaseForms, setReleaseForms] = useState<ReleaseForm[]>([])
  const [prescribedWeeks, setPrescribedWeeks] = useState<PrescribedWeekRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [drugId, setDrugId] = useState('')
  const [severity, setSeverity] = useState<Severity>('mild')
  const [weight, setWeight] = useState(defaultWeightKg != null ? String(defaultWeightKg) : '')
  const [mgPerKg, setMgPerKg] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [patientId])

  useEffect(() => {
    if (!drugId && drugs.length > 0) setDrugId(drugs[0].id)
  }, [drugs, drugId])

  async function load() {
    setLoading(true)
    setError(null)

    const [drugsRes, rulesRes, releaseFormsRes, prescribedWeeksRes] = await Promise.all([
      supabase.from('drugs').select('*').order('name'),
      supabase.from('dosage_rules').select('*'),
      supabase.from('release_forms').select('*'),
      // Фактически выданная кумулятивная доза считается по реальной схеме
      // по неделям (dosage мг/сутки × 7 дней), а не по одному значению
      // calculated_dosage/manual_dosage на назначение.
      supabase
        .from('prescription_weeks')
        .select('dosage, prescriptions!inner(drug_id)')
        .eq('prescriptions.patient_id', patientId),
    ])

    if (drugsRes.error) {
      setError(drugsRes.error.message)
      setLoading(false)
      return
    }
    if (rulesRes.error) {
      setError(rulesRes.error.message)
      setLoading(false)
      return
    }
    if (releaseFormsRes.error) {
      setError(releaseFormsRes.error.message)
      setLoading(false)
      return
    }
    if (prescribedWeeksRes.error) {
      setError(prescribedWeeksRes.error.message)
      setLoading(false)
      return
    }

    setDrugs(drugsRes.data ?? [])
    setRules(rulesRes.data ?? [])
    setReleaseForms(releaseFormsRes.data ?? [])
    setPrescribedWeeks((prescribedWeeksRes.data as unknown as PrescribedWeekRow[] | null) ?? [])
    setLoading(false)
  }

  const prescribedByDrug = useMemo(() => {
    const sums: Record<string, number> = {}
    for (const w of prescribedWeeks) {
      const drugId = w.prescriptions?.drug_id
      if (!drugId) continue
      sums[drugId] = (sums[drugId] ?? 0) + w.dosage * 7
    }
    return sums
  }, [prescribedWeeks])

  const drug = drugs.find((d) => d.id === drugId)
  const rule = rules.find((r) => r.drug_id === drugId && r.severity === severity)
  const weightNum = Number(weight)
  const weightValid = weight.trim() !== '' && !Number.isNaN(weightNum) && weightNum > 0

  useEffect(() => {
    setMgPerKg(rule ? midpoint(rule.mg_per_kg_min, rule.mg_per_kg_max) : null)
  }, [rule?.id])

  const newDose = rule && mgPerKg !== null && weightValid ? calculateDosage(weightNum, mgPerKg) : null

  const alreadyPrescribed = drugId ? Math.round((prescribedByDrug[drugId] ?? 0) * 100) / 100 : 0
  const maxCourseDose =
    drug?.track_cumulative_dose && weightValid && drug.max_cumulative_dose_mg_per_kg
      ? calculateDosage(weightNum, drug.max_cumulative_dose_mg_per_kg)
      : null
  const remaining = maxCourseDose !== null ? Math.round((maxCourseDose - alreadyPrescribed) * 100) / 100 : null
  const alreadyAtOrOverMax = remaining !== null && remaining <= 0
  const remainingWeeks =
    remaining !== null && remaining > 0 && newDose !== null && newDose > 0
      ? calculateCourseDurationWeeks(remaining, newDose)
      : null

  if (loading) return <p className="muted">Загрузка…</p>

  if (drugs.length === 0) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Калькулятор дозировки</h2>
        <p className="muted">
          Сначала добавьте препараты и правила дозирования в справочнике «Препараты».
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
        <div className="field" style={{ minWidth: 160 }}>
          <label htmlFor="pdc_severity">Степень тяжести</label>
          <select
            id="pdc_severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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

      {!rule && <p className="error-text">Для этой степени тяжести правило не задано.</p>}

      {rule && mgPerKg !== null && (
        <div style={{ marginTop: 12 }}>
          <MgPerKgSlider
            id="pdc_mg_per_kg"
            min={rule.mg_per_kg_min}
            max={rule.mg_per_kg_max}
            value={mgPerKg}
            onChange={setMgPerKg}
          />
        </div>
      )}

      {rule && newDose === null && <p className="muted">Введите вес пациента.</p>}
      {rule && newDose !== null && (
        <p>
          Расчётная дозировка нового назначения: <strong>{newDose} мг/сутки</strong>{' '}
          <span className="muted">
            ({weightNum} кг × {mgPerKg} мг/кг)
          </span>
        </p>
      )}

      {drug?.track_cumulative_dose && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
          <h3 style={{ margin: '0 0 8px' }}>Кумулятивная доза</h3>
          {maxCourseDose === null ? (
            <p className="muted">Введите вес, чтобы рассчитать максимальную курсовую дозу.</p>
          ) : (
            <>
              <p style={{ margin: '4px 0' }}>
                Максимальная кумулятивная доза для пациента: <strong>{maxCourseDose} мг</strong>
              </p>
              <p style={{ margin: '4px 0' }}>
                Фактически назначено ранее (сумма по всем неделям всех назначений этого
                препарата): <strong>{alreadyPrescribed} мг</strong>
              </p>
              <p style={{ margin: '4px 0' }}>
                Остаток до максимума: <strong>{remaining} мг</strong>
              </p>
              {alreadyAtOrOverMax ? (
                <p className="error-text" style={{ marginTop: 8 }}>
                  Внимание: по уже назначенным неделям кумулятивная доза достигла или превысила
                  максимум{remaining! < 0 ? ` на ${Math.round(Math.abs(remaining!) * 100) / 100} мг` : ''}.
                </p>
              ) : (
                remainingWeeks !== null && (
                  <p style={{ margin: '4px 0' }}>
                    При дозе {newDose} мг/сутки до максимума остаётся ещё примерно{' '}
                    <strong>{remainingWeeks} нед.</strong>{' '}
                    <span className="muted">
                      (остаток {remaining} мг ÷ {newDose} мг/сутки ÷ 7, округление вверх)
                    </span>
                  </p>
                )
              )}
            </>
          )}
        </div>
      )}

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
