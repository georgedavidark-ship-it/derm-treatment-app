import { useEffect, useState } from 'react'
import type { ReleaseForm } from '../../types/drug'

interface Props {
  // Расчётная доза считается суточной (мг/сутки) — так задаются dosage_rules
  // для препаратов вроде изотретиноина (мг/кг/сутки).
  doseMgPerDay: number | null
  releaseForms: ReleaseForm[]
}

export default function ReleaseFormEstimate({ doseMgPerDay, releaseForms }: Props) {
  const [formId, setFormId] = useState('')
  const [weeks, setWeeks] = useState('4')

  useEffect(() => {
    if (releaseForms.length === 0) {
      if (formId) setFormId('')
      return
    }
    if (!releaseForms.some((f) => f.id === formId)) {
      setFormId(releaseForms[0].id)
    }
  }, [releaseForms, formId])

  if (releaseForms.length === 0) {
    return <p className="muted">Формы выпуска для этого препарата не заданы.</p>
  }

  const form = releaseForms.find((f) => f.id === formId)
  const weeksNum = Number(weeks)
  const weeksValid = weeks.trim() !== '' && !Number.isNaN(weeksNum) && weeksNum > 0

  const unitsPerDay = form && doseMgPerDay !== null ? doseMgPerDay / form.unit_dose_mg : null
  const unitsPerWeek = unitsPerDay !== null ? unitsPerDay * 7 : null
  const packagesPerWeek =
    unitsPerWeek !== null && form ? Math.ceil(unitsPerWeek / form.units_per_package) : null
  const unitsForCourse = unitsPerWeek !== null && weeksValid ? unitsPerWeek * weeksNum : null
  const packagesForCourse =
    unitsForCourse !== null && form ? Math.ceil(unitsForCourse / form.units_per_package) : null

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="release_form_select">Форма выпуска</label>
          <select
            id="release_form_select"
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
          >
            {releaseForms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.form_name} ({f.unit_dose_mg} мг, {f.units_per_package} шт/уп.)
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label htmlFor="release_form_weeks">Длительность курса, нед.</label>
          <input
            id="release_form_weeks"
            type="number"
            step="1"
            min="1"
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
          />
        </div>
      </div>

      {doseMgPerDay === null && (
        <p className="muted">
          Рассчитайте дозировку выше, чтобы увидеть количество единиц и упаковок.
        </p>
      )}

      {doseMgPerDay !== null && form && (
        <>
          <p style={{ margin: '8px 0 4px' }}>
            Единиц в сутки: <strong>{Math.round((unitsPerDay ?? 0) * 100) / 100}</strong>{' '}
            <span className="muted">
              ({doseMgPerDay} мг ÷ {form.unit_dose_mg} мг/ед.)
            </span>
          </p>
          <p style={{ margin: '4px 0' }}>
            Упаковок в неделю: <strong>{packagesPerWeek}</strong>{' '}
            <span className="muted">(округление вверх)</span>
          </p>
          {weeksValid && (
            <p style={{ margin: '4px 0' }}>
              Упаковок на весь курс ({weeksNum} нед.): <strong>{packagesForCourse}</strong>{' '}
              <span className="muted">(округление вверх)</span>
            </p>
          )}
        </>
      )}
    </div>
  )
}
