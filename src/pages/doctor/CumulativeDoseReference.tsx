import { calculateCourseDurationWeeks, calculateDosage } from '../../lib/dosage'
import type { CumulativeDoseOption } from '../../types/drug'

interface Props {
  options: CumulativeDoseOption[]
  weightKg: number | null
  dailyDoseMg: number | null
}

// Показывает именованные варианты кумулятивной дозы препарата рядом с
// расчётом — справочно, для ориентира при выборе длительности курса, без
// привязки к конкретной схеме дозирования и без блокировки назначения
// (см. SPEC.md, раздел 4, cumulative_dose_options, и раздел 5).
export default function CumulativeDoseReference({ options, weightKg, dailyDoseMg }: Props) {
  if (options.length === 0) {
    return <p className="muted">Варианты кумулятивной дозы для этого препарата не заданы.</p>
  }

  if (weightKg === null) {
    return <p className="muted">Введите вес пациента, чтобы увидеть целевые кумулятивные дозы.</p>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Вариант</th>
          <th>Мг/кг за курс</th>
          <th>Целевая доза, мг</th>
          <th>Длительность при текущей суточной дозе</th>
        </tr>
      </thead>
      <tbody>
        {options.map((o) => {
          const targetMg = calculateDosage(weightKg, o.max_cumulative_dose_mg_per_kg)
          const durationWeeks =
            dailyDoseMg !== null && dailyDoseMg > 0
              ? calculateCourseDurationWeeks(targetMg, dailyDoseMg)
              : null
          return (
            <tr key={o.id}>
              <td>{o.name}</td>
              <td>{o.max_cumulative_dose_mg_per_kg}</td>
              <td>{targetMg}</td>
              <td>{durationWeeks !== null ? `≈ ${durationWeeks} нед.` : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
