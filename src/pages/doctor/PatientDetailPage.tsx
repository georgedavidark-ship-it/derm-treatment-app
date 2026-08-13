import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Patient } from '../../types/patient'
import DiagnosesSection from './DiagnosesSection'
import PrescriptionsSection from './PrescriptionsSection'
import PatientDosageCalculator from './PatientDosageCalculator'
import SkincareRoutinesSection from './SkincareRoutinesSection'
import PatientPhotosSection from './PatientPhotosSection'

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    load(id)
  }, [id])

  async function load(patientId: string) {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single()

    if (error) {
      setError(error.message)
    } else {
      setPatient(data)
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!patient) return
    if (!confirm(`Удалить пациента «${patient.full_name}»? Это действие необратимо.`)) return
    const { error } = await supabase.from('patients').delete().eq('id', patient.id)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/doctor')
  }

  async function handleRegenerateToken() {
    if (!patient) return
    if (!confirm('Старая ссылка перестанет работать. Перевыпустить ссылку пациента?')) return
    const newToken = crypto.randomUUID()
    const { error } = await supabase
      .from('patients')
      .update({ access_token: newToken })
      .eq('id', patient.id)
    if (error) {
      setError(error.message)
      return
    }
    setPatient({ ...patient, access_token: newToken })
  }

  function copyLink() {
    if (!patient) return
    const url = `${window.location.origin}${import.meta.env.BASE_URL}patient/${patient.access_token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) return <p className="muted">Загрузка…</p>
  if (error) return <p className="error-text">{error}</p>
  if (!patient) return <p className="muted">Пациент не найден.</p>

  const patientLink = `${window.location.origin}${import.meta.env.BASE_URL}patient/${patient.access_token}`

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>{patient.full_name}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link className="btn secondary" to={`/doctor/patients/${patient.id}/edit`}>
            Редактировать
          </Link>
          <button className="btn danger" onClick={handleDelete}>
            Удалить
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p>
          <strong>Дата рождения:</strong> {patient.birth_date ?? '—'}
        </p>
        <p>
          <strong>Контакты:</strong> {patient.contact_info ?? '—'}
        </p>
        <p>
          <strong>Вес:</strong>{' '}
          {patient.weight_kg != null ? `${patient.weight_kg} кг` : '—'}
        </p>
        <p>
          <strong>Карточка создана:</strong>{' '}
          {new Date(patient.created_at).toLocaleDateString('ru-RU')}
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Ссылка для пациента</h2>
        <p className="muted" style={{ wordBreak: 'break-all' }}>
          {patientLink}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={copyLink}>
            {copied ? 'Скопировано!' : 'Скопировать ссылку'}
          </button>
          <button className="btn secondary" onClick={handleRegenerateToken}>
            Перевыпустить ссылку
          </button>
        </div>
      </div>

      <DiagnosesSection patientId={patient.id} />

      <PrescriptionsSection patientId={patient.id} defaultWeightKg={patient.weight_kg} />

      <PatientDosageCalculator patientId={patient.id} defaultWeightKg={patient.weight_kg} />

      <SkincareRoutinesSection patientId={patient.id} />

      <PatientPhotosSection patientId={patient.id} />
    </div>
  )
}
