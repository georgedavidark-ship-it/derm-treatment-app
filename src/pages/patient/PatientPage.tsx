import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { currentWeekNumber } from '../../lib/patientWeek'

interface PatientInfo {
  id: string
  full_name: string
  birth_date: string | null
  weight_kg: number | null
  created_at: string
}

interface PatientPrescription {
  id: string
  drug_id: string
  drug_name: string
  severity: string
  calculated_dosage: number
  manual_dosage: number | null
  start_date: string
  status: 'active' | 'completed'
}

interface PatientPrescriptionWeek {
  id: string
  prescription_id: string
  week_number: number
  dosage: number
  comment: string | null
}

interface PatientSkincareRoutine {
  id: string
  products_and_procedures: string | null
  instructions: string | null
}

export default function PatientPage() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [prescriptions, setPrescriptions] = useState<PatientPrescription[]>([])
  const [weeks, setWeeks] = useState<PatientPrescriptionWeek[]>([])
  const [skincare, setSkincare] = useState<PatientSkincareRoutine[]>([])

  useEffect(() => {
    if (token) load(token)
  }, [token])

  async function load(tok: string) {
    setLoading(true)
    setError(null)

    const { data: patientRows, error: patientError } = await supabase.rpc('get_patient_by_token', {
      p_token: tok,
    })

    if (patientError) {
      setError(patientError.message)
      setLoading(false)
      return
    }

    const patientRow: PatientInfo | null = patientRows?.[0] ?? null
    setPatient(patientRow)

    if (!patientRow) {
      setLoading(false)
      return
    }

    const [prescriptionsRes, weeksRes, skincareRes] = await Promise.all([
      supabase.rpc('get_patient_prescriptions_by_token', { p_token: tok }),
      supabase.rpc('get_patient_prescription_weeks_by_token', { p_token: tok }),
      supabase.rpc('get_patient_skincare_by_token', { p_token: tok }),
    ])

    if (prescriptionsRes.error) {
      setError(prescriptionsRes.error.message)
      setLoading(false)
      return
    }
    if (weeksRes.error) {
      setError(weeksRes.error.message)
      setLoading(false)
      return
    }
    if (skincareRes.error) {
      setError(skincareRes.error.message)
      setLoading(false)
      return
    }

    setPrescriptions(prescriptionsRes.data ?? [])
    setWeeks(weeksRes.data ?? [])
    setSkincare(skincareRes.data ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Загрузка…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <p className="error-text">{error}</p>
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="page">
        <div className="card">
          <h1>Ссылка недействительна</h1>
          <p className="muted">
            Эта ссылка больше не работает — возможно, она была отозвана врачом. Обратитесь к
            своему врачу за новой ссылкой.
          </p>
        </div>
      </div>
    )
  }

  const activePrescription = prescriptions.find((p) => p.status === 'active') ?? null
  const activeWeeks = activePrescription
    ? weeks
        .filter((w) => w.prescription_id === activePrescription.id)
        .sort((a, b) => a.week_number - b.week_number)
    : []
  const totalWeeks = activeWeeks.length
  const currentWeek =
    activePrescription && totalWeeks > 0
      ? currentWeekNumber(activePrescription.start_date, totalWeeks)
      : null
  const currentWeekRow = currentWeek !== null ? activeWeeks.find((w) => w.week_number === currentWeek) ?? null : null
  const currentDosage =
    currentWeekRow?.dosage ??
    (activePrescription ? activePrescription.manual_dosage ?? activePrescription.calculated_dosage : null)

  return (
    <div className="page">
      <div className="card" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{patient.full_name}</h1>
        {activePrescription && currentWeek !== null ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Неделя лечения: <strong>{currentWeek}</strong> из {totalWeeks}
          </p>
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>
            Активного курса лечения сейчас нет.
          </p>
        )}
      </div>

      {activePrescription && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Текущая дозировка</h2>
          <p style={{ margin: '4px 0' }}>
            <strong>{activePrescription.drug_name}</strong>
            {currentDosage !== null && <>: {currentDosage} мг/сутки</>}
          </p>
          {currentWeekRow?.comment && <p className="muted" style={{ margin: '4px 0' }}>{currentWeekRow.comment}</p>}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Уход за кожей</h2>
        {skincare.length === 0 ? (
          <p className="muted">Уход за кожей не назначен.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {skincare.map((s) => (
              <li key={s.id} style={{ marginBottom: 10 }}>
                {s.products_and_procedures && <div>{s.products_and_procedures}</div>}
                {s.instructions && <div className="muted">{s.instructions}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {activePrescription && totalWeeks > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>История по неделям</h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>Неделя</th>
                <th>Дозировка</th>
              </tr>
            </thead>
            <tbody>
              {activeWeeks.map((w) => (
                <tr key={w.id} style={w.week_number === currentWeek ? { background: 'var(--color-bg)' } : undefined}>
                  <td>
                    {w.week_number}
                    {w.week_number === currentWeek && <span className="muted"> (сейчас)</span>}
                  </td>
                  <td>{w.dosage} мг/сутки</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
