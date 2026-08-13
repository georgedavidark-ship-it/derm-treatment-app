import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { calculateCourseDurationWeeks, calculateDosage, midpoint } from '../../lib/dosage'
import { SEVERITIES, type Drug, type DosageRule, type ReleaseForm, type Severity } from '../../types/drug'
import ReleaseFormsSection from './ReleaseFormsSection'
import ReleaseFormEstimate from './ReleaseFormEstimate'
import MgPerKgSlider from './MgPerKgSlider'

type RangeInputs = Record<Severity, { min: string; max: string }>

interface CumulativeSettings {
  track: boolean
  max: string
}

function emptyRangeInputs(): RangeInputs {
  return {
    mild: { min: '', max: '' },
    moderate: { min: '', max: '' },
    severe: { min: '', max: '' },
  }
}

function emptyCumulativeSettings(): CumulativeSettings {
  return { track: false, max: '' }
}

export default function DrugsPage() {
  const { session } = useAuth()
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [rules, setRules] = useState<DosageRule[]>([])
  const [releaseForms, setReleaseForms] = useState<ReleaseForm[]>([])
  const [ruleInputs, setRuleInputs] = useState<Record<string, RangeInputs>>({})
  const [cumulativeSettings, setCumulativeSettings] = useState<Record<string, CumulativeSettings>>(
    {},
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newDrugName, setNewDrugName] = useState('')
  const [creatingDrug, setCreatingDrug] = useState(false)
  const [savingDrugId, setSavingDrugId] = useState<string | null>(null)

  const [calcDrugId, setCalcDrugId] = useState('')
  const [calcSeverity, setCalcSeverity] = useState<Severity>('mild')
  const [calcWeight, setCalcWeight] = useState('')
  const [calcMgPerKg, setCalcMgPerKg] = useState<number | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!calcDrugId && drugs.length > 0) setCalcDrugId(drugs[0].id)
  }, [drugs, calcDrugId])

  async function loadAll() {
    setLoading(true)
    setError(null)

    const [drugsRes, rulesRes, releaseFormsRes] = await Promise.all([
      supabase.from('drugs').select('*').order('name'),
      supabase.from('dosage_rules').select('*'),
      supabase.from('release_forms').select('*'),
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

    const nextDrugs: Drug[] = drugsRes.data ?? []
    const nextRules: DosageRule[] = rulesRes.data ?? []

    const inputs: Record<string, RangeInputs> = {}
    for (const d of nextDrugs) inputs[d.id] = emptyRangeInputs()
    for (const r of nextRules) {
      if (!inputs[r.drug_id]) inputs[r.drug_id] = emptyRangeInputs()
      inputs[r.drug_id][r.severity] = { min: String(r.mg_per_kg_min), max: String(r.mg_per_kg_max) }
    }

    const cumulative: Record<string, CumulativeSettings> = {}
    for (const d of nextDrugs) {
      cumulative[d.id] = {
        track: d.track_cumulative_dose,
        max: d.max_cumulative_dose_mg_per_kg != null ? String(d.max_cumulative_dose_mg_per_kg) : '',
      }
    }

    setDrugs(nextDrugs)
    setRules(nextRules)
    setReleaseForms(releaseFormsRes.data ?? [])
    setRuleInputs(inputs)
    setCumulativeSettings(cumulative)
    setLoading(false)
  }

  function getRule(drugId: string, severity: Severity) {
    return rules.find((r) => r.drug_id === drugId && r.severity === severity)
  }

  function updateRuleInput(drugId: string, severity: Severity, patch: Partial<{ min: string; max: string }>) {
    setRuleInputs((prev) => ({
      ...prev,
      [drugId]: {
        ...(prev[drugId] ?? emptyRangeInputs()),
        [severity]: { ...(prev[drugId]?.[severity] ?? { min: '', max: '' }), ...patch },
      },
    }))
  }

  function updateCumulativeSettings(drugId: string, patch: Partial<CumulativeSettings>) {
    setCumulativeSettings((prev) => ({
      ...prev,
      [drugId]: { ...(prev[drugId] ?? emptyCumulativeSettings()), ...patch },
    }))
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
    if (!confirm('Удалить препарат вместе с правилами дозирования?')) return
    const { error } = await supabase.from('drugs').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    loadAll()
  }

  async function handleSaveRules(drugId: string) {
    const cumulative = cumulativeSettings[drugId] ?? emptyCumulativeSettings()
    const maxCumulativeNum = cumulative.max.trim() ? Number(cumulative.max) : NaN

    if (cumulative.track && (Number.isNaN(maxCumulativeNum) || maxCumulativeNum <= 0)) {
      setError('Укажите максимальную кумулятивную дозу (мг/кг) больше нуля.')
      return
    }

    const inputs = ruleInputs[drugId] ?? emptyRangeInputs()
    for (const s of SEVERITIES) {
      const { min, max } = inputs[s.value]
      if (!min.trim() && !max.trim()) continue
      const minNum = Number(min)
      const maxNum = Number(max)
      if (Number.isNaN(minNum) || Number.isNaN(maxNum) || minNum <= 0 || maxNum < minNum) {
        setError(
          `Проверьте диапазон для степени «${SEVERITIES.find((x) => x.value === s.value)?.label}»: минимум должен быть больше нуля, максимум — не меньше минимума.`,
        )
        return
      }
    }

    setSavingDrugId(drugId)
    setError(null)

    const { error: drugError } = await supabase
      .from('drugs')
      .update({
        track_cumulative_dose: cumulative.track,
        max_cumulative_dose_mg_per_kg: cumulative.track ? maxCumulativeNum : null,
      })
      .eq('id', drugId)

    if (drugError) {
      setError(drugError.message)
      setSavingDrugId(null)
      return
    }

    const upserts: { drug_id: string; severity: Severity; mg_per_kg_min: number; mg_per_kg_max: number }[] = []
    const deleteIds: string[] = []

    for (const s of SEVERITIES) {
      const { min, max } = inputs[s.value]
      const existing = getRule(drugId, s.value)
      if (min.trim() && max.trim()) {
        upserts.push({ drug_id: drugId, severity: s.value, mg_per_kg_min: Number(min), mg_per_kg_max: Number(max) })
      } else if (existing) {
        deleteIds.push(existing.id)
      }
    }

    if (upserts.length > 0) {
      const { error } = await supabase
        .from('dosage_rules')
        .upsert(upserts, { onConflict: 'drug_id,severity' })
      if (error) {
        setError(error.message)
        setSavingDrugId(null)
        return
      }
    }

    if (deleteIds.length > 0) {
      const { error } = await supabase.from('dosage_rules').delete().in('id', deleteIds)
      if (error) {
        setError(error.message)
        setSavingDrugId(null)
        return
      }
    }

    setSavingDrugId(null)
    loadAll()
  }

  const calcDrug = drugs.find((d) => d.id === calcDrugId)
  const calcRule = calcDrugId ? getRule(calcDrugId, calcSeverity) : undefined
  const calcWeightNum = Number(calcWeight)
  const calcWeightValid = calcWeight.trim() !== '' && !Number.isNaN(calcWeightNum) && calcWeightNum > 0

  useEffect(() => {
    setCalcMgPerKg(calcRule ? midpoint(calcRule.mg_per_kg_min, calcRule.mg_per_kg_max) : null)
  }, [calcRule?.id])

  const calcResult =
    calcRule && calcMgPerKg !== null && calcWeightValid ? calculateDosage(calcWeightNum, calcMgPerKg) : null
  const calcMaxCourseDose =
    calcDrug?.track_cumulative_dose && calcWeightValid && calcDrug.max_cumulative_dose_mg_per_kg
      ? calculateDosage(calcWeightNum, calcDrug.max_cumulative_dose_mg_per_kg)
      : null
  const calcDurationWeeks =
    calcMaxCourseDose !== null && calcResult !== null && calcResult > 0
      ? calculateCourseDurationWeeks(calcMaxCourseDose, calcResult)
      : null

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

      {drugs.map((drug) => {
        const inputs = ruleInputs[drug.id] ?? emptyRangeInputs()
        const cumulative = cumulativeSettings[drug.id] ?? emptyCumulativeSettings()
        return (
          <div className="card" style={{ marginBottom: 16 }} key={drug.id}>
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{drug.name}</h2>
              <button className="btn danger" onClick={() => handleDeleteDrug(drug.id)}>
                Удалить препарат
              </button>
            </div>

            <p className="muted" style={{ marginTop: 0 }}>
              Диапазон суточной дозы (мг/кг/сутки, минимум–максимум) по степени тяжести:
            </p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {SEVERITIES.map((s) => (
                <div key={s.value} style={{ minWidth: 220 }}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--color-muted)', marginBottom: 4 }}>
                    {s.label}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id={`${drug.id}-${s.value}-min`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="мин мг/кг"
                      value={inputs[s.value].min}
                      onChange={(e) => updateRuleInput(drug.id, s.value, { min: e.target.value })}
                      style={{ width: 100, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6 }}
                    />
                    <span className="muted" style={{ alignSelf: 'center' }}>
                      –
                    </span>
                    <input
                      id={`${drug.id}-${s.value}-max`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="макс мг/кг"
                      value={inputs[s.value].max}
                      onChange={(e) => updateRuleInput(drug.id, s.value, { max: e.target.value })}
                      style={{ width: 100, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 16,
                marginBottom: cumulative.track ? 12 : 0,
              }}
            >
              <input
                id={`${drug.id}-track-cumulative`}
                type="checkbox"
                checked={cumulative.track}
                onChange={(e) => updateCumulativeSettings(drug.id, { track: e.target.checked })}
              />
              <label htmlFor={`${drug.id}-track-cumulative`} style={{ margin: 0 }}>
                Учитывать кумулятивную дозу
              </label>
            </div>

            {cumulative.track && (
              <div className="field" style={{ maxWidth: 260 }}>
                <label htmlFor={`${drug.id}-max-cumulative`}>
                  Максимальная кумулятивная доза (мг/кг за весь курс)
                </label>
                <input
                  id={`${drug.id}-max-cumulative`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="мг/кг за курс"
                  value={cumulative.max}
                  onChange={(e) => updateCumulativeSettings(drug.id, { max: e.target.value })}
                />
              </div>
            )}

            <button
              className="btn secondary"
              onClick={() => handleSaveRules(drug.id)}
              disabled={savingDrugId === drug.id}
            >
              {savingDrugId === drug.id ? 'Сохраняем…' : 'Сохранить настройки'}
            </button>

            <ReleaseFormsSection drugId={drug.id} onChanged={loadAll} />
          </div>
        )
      })}

      {drugs.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Калькулятор дозировки</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Справочный расчёт по сохранённым правилам. Итоговое назначение с фиксацией дозировки
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
            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor="calc_severity">Степень тяжести</label>
              <select
                id="calc_severity"
                value={calcSeverity}
                onChange={(e) => setCalcSeverity(e.target.value as Severity)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
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

          {!calcRule && (
            <p className="error-text">Для этой степени тяжести правило дозирования не задано.</p>
          )}

          {calcRule && calcMgPerKg !== null && (
            <div style={{ marginTop: 12 }}>
              <MgPerKgSlider
                id="calc_mg_per_kg"
                min={calcRule.mg_per_kg_min}
                max={calcRule.mg_per_kg_max}
                value={calcMgPerKg}
                onChange={setCalcMgPerKg}
              />
            </div>
          )}

          {calcRule && calcResult === null && (
            <p className="muted">Введите вес пациента, чтобы увидеть расчёт.</p>
          )}
          {calcRule && calcResult !== null && (
            <p>
              Итоговая дозировка: <strong>{calcResult} мг/сутки</strong>{' '}
              <span className="muted">
                ({calcWeightNum} кг × {calcMgPerKg} мг/кг)
              </span>
            </p>
          )}
          {calcMaxCourseDose !== null && (
            <p className="muted">
              Максимальная курсовая доза для этого веса: {calcMaxCourseDose} мг (
              {calcDrug!.max_cumulative_dose_mg_per_kg} мг/кг × {calcWeightNum} кг). Сумма уже
              назначенных доз считается в карточке конкретного пациента.
            </p>
          )}
          {calcDurationWeeks !== null && (
            <p className="muted">
              Расчётная длительность курса: <strong>{calcDurationWeeks} нед.</strong> (
              {calcMaxCourseDose} мг ÷ {calcResult} мг/сутки ÷ 7, округление вверх)
            </p>
          )}

          <ReleaseFormEstimate
            doseMgPerDay={calcResult}
            releaseForms={releaseForms.filter((f) => f.drug_id === calcDrugId)}
          />
        </div>
      )}
    </div>
  )
}
