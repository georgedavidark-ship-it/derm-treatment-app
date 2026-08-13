import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { calculateCourseDurationWeeks, calculateDosage, midpoint } from '../../lib/dosage'
import { SEVERITIES, type Drug, type DosageRule, type Severity } from '../../types/drug'
import type { Diagnosis } from '../../types/diagnosis'
import { PRESCRIPTION_STATUSES, type Prescription, type PrescriptionStatus } from '../../types/prescription'
import PrescriptionWeeksEditor from './PrescriptionWeeksEditor'
import MgPerKgSlider from './MgPerKgSlider'

type DoseMode = 'fixed' | 'titration'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  patientId: string
  defaultWeightKg?: number | null
}

export default function PrescriptionsSection({ patientId, defaultWeightKg }: Props) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [rules, setRules] = useState<DosageRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [diagnosisId, setDiagnosisId] = useState('')
  const [drugId, setDrugId] = useState('')
  const [severity, setSeverity] = useState<Severity>('mild')
  const [weight, setWeight] = useState(defaultWeightKg != null ? String(defaultWeightKg) : '')
  const [mgPerKg, setMgPerKg] = useState<number | null>(null)
  const [manualDosage, setManualDosage] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [durationWeeks, setDurationWeeks] = useState('4')
  const [durationTouched, setDurationTouched] = useState(false)
  const [doseMode, setDoseMode] = useState<DoseMode>('fixed')
  const [weeklyDoses, setWeeklyDoses] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [patientId])

  useEffect(() => {
    if (!drugId && drugs.length > 0) setDrugId(drugs[0].id)
  }, [drugs, drugId])

  async function load() {
    setLoading(true)
    setError(null)

    const [prescriptionsRes, diagnosesRes, drugsRes, rulesRes] = await Promise.all([
      supabase
        .from('prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .order('start_date', { ascending: false }),
      supabase
        .from('diagnoses')
        .select('*')
        .eq('patient_id', patientId)
        .order('diagnosed_at', { ascending: false }),
      supabase.from('drugs').select('*').order('name'),
      supabase.from('dosage_rules').select('*'),
    ])

    if (prescriptionsRes.error) {
      setError(prescriptionsRes.error.message)
      setLoading(false)
      return
    }
    if (diagnosesRes.error) {
      setError(diagnosesRes.error.message)
      setLoading(false)
      return
    }
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

    setPrescriptions(prescriptionsRes.data ?? [])
    setDiagnoses(diagnosesRes.data ?? [])
    setDrugs(drugsRes.data ?? [])
    setRules(rulesRes.data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setDiagnosisId('')
    setDrugId(drugs[0]?.id ?? '')
    setSeverity('mild')
    setWeight(defaultWeightKg != null ? String(defaultWeightKg) : '')
    setManualDosage('')
    setStartDate(todayIso())
    setDurationWeeks('4')
    setDurationTouched(false)
    setDoseMode('fixed')
    setWeeklyDoses([])
    setShowForm(false)
  }

  const drug = drugs.find((d) => d.id === drugId)
  const rule = drugId ? rules.find((r) => r.drug_id === drugId && r.severity === severity) : undefined

  useEffect(() => {
    setMgPerKg(rule ? midpoint(rule.mg_per_kg_min, rule.mg_per_kg_max) : null)
  }, [rule?.id])

  useEffect(() => {
    setDurationTouched(false)
  }, [drugId])

  const weightNum = Number(weight)
  const weightValid = weight.trim() !== '' && !Number.isNaN(weightNum) && weightNum > 0
  const calculatedDosage =
    rule && mgPerKg !== null && weightValid ? calculateDosage(weightNum, mgPerKg) : null
  const manualNum = manualDosage.trim() !== '' ? Number(manualDosage) : null
  const manualValid = manualDosage.trim() === '' || (!Number.isNaN(manualNum) && (manualNum as number) > 0)
  const effectiveDosage = manualValid && manualNum !== null ? manualNum : calculatedDosage

  const targetCumulativeDoseMg =
    drug?.track_cumulative_dose && drug.max_cumulative_dose_mg_per_kg && weightValid
      ? calculateDosage(weightNum, drug.max_cumulative_dose_mg_per_kg)
      : null
  const suggestedDuration =
    targetCumulativeDoseMg !== null && effectiveDosage !== null && effectiveDosage > 0
      ? calculateCourseDurationWeeks(targetCumulativeDoseMg, effectiveDosage)
      : null

  const durationNum = Number(durationWeeks)
  const durationValid = Number.isInteger(durationNum) && durationNum > 0

  // Фактическая сумма по реально введённой схеме — при титровании считается
  // по значениям, которые врач ввёл в таблицу по неделям, а не по исходной
  // равномерной оценке (suggestedDuration). Поле недели хранит суточную дозу
  // (мг/сутки), поэтому каждую неделю нужно умножать на 7 дней.
  let actualCumulativeDose: number | null = null
  if (doseMode === 'fixed') {
    actualCumulativeDose =
      effectiveDosage !== null && durationValid
        ? Math.round(effectiveDosage * durationNum * 7 * 100) / 100
        : null
  } else if (durationValid && weeklyDoses.length === durationNum) {
    const parsedWeeklyDoses = weeklyDoses.map((v) => Number(v))
    if (parsedWeeklyDoses.every((v) => !Number.isNaN(v) && v >= 0)) {
      actualCumulativeDose =
        Math.round(parsedWeeklyDoses.reduce((a, b) => a + b * 7, 0) * 100) / 100
    }
  }

  const cumulativeDiff =
    targetCumulativeDoseMg !== null && actualCumulativeDose !== null
      ? Math.round((actualCumulativeDose - targetCumulativeDoseMg) * 100) / 100
      : null

  useEffect(() => {
    if (!durationTouched && suggestedDuration !== null) {
      setDurationWeeks(String(suggestedDuration))
    }
  }, [suggestedDuration, durationTouched])

  useEffect(() => {
    if (doseMode !== 'titration') return
    const n = Math.max(0, Math.floor(Number(durationWeeks)) || 0)
    setWeeklyDoses((prev) => {
      const next = prev.slice(0, n)
      while (next.length < n) {
        const fallback = next.length > 0 ? next[next.length - 1] : effectiveDosage !== null ? String(effectiveDosage) : ''
        next.push(fallback)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationWeeks, doseMode])

  function updateWeeklyDose(index: number, value: string) {
    setWeeklyDoses((prev) => prev.map((v, i) => (i === index ? value : v)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!drugId || !rule || calculatedDosage === null) {
      setError('Выберите препарат и укажите вес — для выбранной степени тяжести должно быть задано правило дозирования.')
      return
    }
    if (!manualValid) {
      setError('Ручная корректировка дозировки должна быть положительным числом.')
      return
    }
    if (!Number.isInteger(durationNum) || durationNum <= 0) {
      setError('Длительность курса должна быть целым числом недель больше нуля.')
      return
    }

    let weekDosages: number[]
    if (doseMode === 'titration') {
      if (weeklyDoses.length !== durationNum) {
        setError('Заполните дозировку для каждой недели.')
        return
      }
      const parsed = weeklyDoses.map((v) => Number(v))
      if (parsed.some((v) => Number.isNaN(v) || v < 0)) {
        setError('Дозировка каждой недели должна быть неотрицательным числом.')
        return
      }
      weekDosages = parsed
    } else {
      weekDosages = Array.from({ length: durationNum }, () => effectiveDosage as number)
    }

    setSaving(true)
    setError(null)

    const { data: prescription, error: prescriptionError } = await supabase
      .from('prescriptions')
      .insert({
        patient_id: patientId,
        diagnosis_id: diagnosisId || null,
        drug_id: drugId,
        weight_kg: weightNum,
        severity,
        calculated_dosage: calculatedDosage,
        manual_dosage: manualNum,
        start_date: startDate,
        status: 'active',
      })
      .select('id')
      .single()

    if (prescriptionError || !prescription) {
      setError(prescriptionError?.message ?? 'Не удалось создать назначение.')
      setSaving(false)
      return
    }

    const weeksPayload = weekDosages.map((dosage, i) => ({
      prescription_id: prescription.id,
      week_number: i + 1,
      dosage,
      comment: null as string | null,
    }))

    const { error: weeksError } = await supabase.from('prescription_weeks').insert(weeksPayload)

    setSaving(false)

    if (weeksError) {
      setError(`Назначение создано, но не удалось построить схему по неделям: ${weeksError.message}`)
      load()
      return
    }

    resetForm()
    setExpandedId(prescription.id)
    load()
  }

  async function handleToggleStatus(p: Prescription) {
    const nextStatus: PrescriptionStatus = p.status === 'active' ? 'completed' : 'active'
    const { error } = await supabase.from('prescriptions').update({ status: nextStatus }).eq('id', p.id)
    if (error) {
      setError(error.message)
      return
    }
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить назначение вместе со схемой по неделям?')) return
    const { error } = await supabase.from('prescriptions').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    load()
  }

  function drugName(id: string) {
    return drugs.find((d) => d.id === id)?.name ?? '—'
  }

  function severityLabel(s: Severity) {
    return SEVERITIES.find((x) => x.value === s)?.label ?? s
  }

  function statusLabel(s: PrescriptionStatus) {
    return PRESCRIPTION_STATUSES.find((x) => x.value === s)?.label ?? s
  }

  if (loading) return <p className="muted">Загрузка…</p>

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="toolbar" style={{ marginBottom: showForm || prescriptions.length ? 16 : 0 }}>
        <h2 style={{ margin: 0 }}>Назначения препарата</h2>
        {!showForm && drugs.length > 0 && (
          <button className="btn" onClick={() => setShowForm(true)}>
            + Новое назначение
          </button>
        )}
      </div>

      {drugs.length === 0 && (
        <p className="muted">
          Сначала добавьте препараты и правила дозирования в справочнике «Препараты».
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor="pr_diagnosis">Диагноз (необязательно)</label>
              <select
                id="pr_diagnosis"
                value={diagnosisId}
                onChange={(e) => setDiagnosisId(e.target.value)}
              >
                <option value="">Не указан</option>
                {diagnoses.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.diagnosis_type} ({new Date(d.diagnosed_at).toLocaleDateString('ru-RU')})
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ minWidth: 180 }}>
              <label htmlFor="pr_drug">Препарат</label>
              <select id="pr_drug" value={drugId} onChange={(e) => setDrugId(e.target.value)}>
                {drugs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor="pr_severity">Степень тяжести</label>
              <select
                id="pr_severity"
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
              <label htmlFor="pr_weight">Вес, кг</label>
              <input
                id="pr_weight"
                type="number"
                step="0.1"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
              {defaultWeightKg != null && (
                <span className="muted" style={{ fontSize: 12 }}>
                  Из карточки пациента, можно скорректировать
                </span>
              )}
            </div>
          </div>

          {!rule && drugId && (
            <p className="error-text">Для этой степени тяжести правило дозирования не задано.</p>
          )}

          {rule && mgPerKg !== null && (
            <div style={{ marginTop: 12 }}>
              <MgPerKgSlider
                id="pr_mg_per_kg"
                min={rule.mg_per_kg_min}
                max={rule.mg_per_kg_max}
                value={mgPerKg}
                onChange={setMgPerKg}
              />
            </div>
          )}

          {rule && calculatedDosage !== null && (
            <p className="muted">
              Расчётная дозировка: {calculatedDosage} мг/сутки ({weightNum} кг × {mgPerKg} мг/кг)
            </p>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor="pr_manual">Ручная корректировка, мг/сутки (необязательно)</label>
              <input
                id="pr_manual"
                type="number"
                step="0.01"
                min="0"
                placeholder={calculatedDosage !== null ? String(calculatedDosage) : ''}
                value={manualDosage}
                onChange={(e) => setManualDosage(e.target.value)}
              />
            </div>
            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor="pr_start_date">Дата начала</label>
              <input
                id="pr_start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor="pr_duration">Длительность курса, недель</label>
              <input
                id="pr_duration"
                type="number"
                step="1"
                min="1"
                value={durationWeeks}
                onChange={(e) => {
                  setDurationTouched(true)
                  setDurationWeeks(e.target.value)
                }}
                required
              />
            </div>
          </div>

          {suggestedDuration !== null && (
            <p className="muted">
              Расчётная длительность при равномерной дозе {effectiveDosage} мг/сутки:{' '}
              <strong>{suggestedDuration} нед.</strong> (целевая кумулятивная доза{' '}
              {targetCumulativeDoseMg} мг ÷ {effectiveDosage} мг/сутки ÷ 7, округление вверх)
              {durationTouched ? ' — вы задали своё значение длительности.' : ''}
            </p>
          )}

          <div className="field">
            <label style={{ display: 'block', marginBottom: 6 }}>Дозировка по неделям</label>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'normal' }}>
                <input
                  type="radio"
                  name="dose_mode"
                  checked={doseMode === 'fixed'}
                  onChange={() => setDoseMode('fixed')}
                />
                Фиксированная доза на весь курс
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'normal' }}>
                <input
                  type="radio"
                  name="dose_mode"
                  checked={doseMode === 'titration'}
                  onChange={() => setDoseMode('titration')}
                />
                Меняется по неделям (титрование)
              </label>
            </div>
          </div>

          {doseMode === 'fixed' && effectiveDosage !== null && (
            <p className="muted">
              Схема из {durationWeeks || 0} недель будет создана с одинаковой дозировкой{' '}
              {effectiveDosage} мг/сутки на каждую неделю — при необходимости её можно будет
              скорректировать по неделям после сохранения.
            </p>
          )}

          {doseMode === 'titration' && weeklyDoses.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {weeklyDoses.map((v, i) => (
                <div key={i} style={{ width: 110 }}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--color-muted)', marginBottom: 4 }}>
                    Неделя {i + 1}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={v}
                    onChange={(e) => updateWeeklyDose(i, e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 6 }}
                  />
                </div>
              ))}
            </div>
          )}

          {targetCumulativeDoseMg !== null && (
            <div
              style={{
                marginTop: 4,
                marginBottom: 16,
                padding: 12,
                background: 'var(--color-bg)',
                borderRadius: 8,
              }}
            >
              <p style={{ margin: '2px 0' }}>
                Целевая кумулятивная доза для пациента: <strong>{targetCumulativeDoseMg} мг</strong>
              </p>
              {actualCumulativeDose !== null ? (
                <>
                  <p style={{ margin: '6px 0 2px' }}>
                    Фактическая сумма по введённой схеме ({durationNum} нед.):{' '}
                    <strong>{actualCumulativeDose} мг</strong>
                  </p>
                  {cumulativeDiff !== null && Math.abs(cumulativeDiff) > 0.01 && (
                    <p className={cumulativeDiff > 0 ? 'error-text' : 'muted'} style={{ margin: '2px 0' }}>
                      {cumulativeDiff > 0
                        ? `Превышает целевую кумулятивную дозу на ${Math.round(cumulativeDiff * 100) / 100} мг.`
                        : `Ниже целевой кумулятивной дозы на ${Math.round(Math.abs(cumulativeDiff) * 100) / 100} мг.`}
                    </p>
                  )}
                </>
              ) : (
                doseMode === 'titration' && (
                  <p className="muted" style={{ margin: '6px 0 2px' }}>
                    Заполните дозировку каждой недели, чтобы увидеть фактическую сумму.
                  </p>
                )
              )}
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Сохраняем…' : 'Создать назначение'}
            </button>
            <button className="btn secondary" type="button" onClick={resetForm} disabled={saving}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {!showForm && error && <p className="error-text">{error}</p>}

      {prescriptions.length === 0 && !showForm && drugs.length > 0 && (
        <p className="muted">Назначений пока нет.</p>
      )}

      {prescriptions.map((p) => {
        const dosage = p.manual_dosage ?? p.calculated_dosage
        const expanded = expandedId === p.id
        return (
          <div
            key={p.id}
            className="card"
            style={{ marginBottom: 12, background: 'var(--color-bg)' }}
          >
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <div>
                <strong>{drugName(p.drug_id)}</strong>{' '}
                <span className="muted">
                  · {severityLabel(p.severity)} · {dosage} мг/сутки · с{' '}
                  {new Date(p.start_date).toLocaleDateString('ru-RU')} · {statusLabel(p.status)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn secondary"
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                >
                  {expanded ? 'Скрыть схему' : 'Схема по неделям'}
                </button>
                <button className="btn secondary" onClick={() => handleToggleStatus(p)}>
                  {p.status === 'active' ? 'Завершить' : 'Возобновить'}
                </button>
                <button className="btn danger" onClick={() => handleDelete(p.id)}>
                  Удалить
                </button>
              </div>
            </div>

            {expanded && <PrescriptionWeeksEditor prescriptionId={p.id} />}
          </div>
        )
      })}
    </div>
  )
}
