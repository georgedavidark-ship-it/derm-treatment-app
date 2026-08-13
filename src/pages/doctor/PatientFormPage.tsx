import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

export default function PatientFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { session } = useAuth()

  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit || !id) return
    supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError(error.message)
        } else if (data) {
          setFullName(data.full_name)
          setBirthDate(data.birth_date ?? '')
          setContactInfo(data.contact_info ?? '')
          setWeightKg(data.weight_kg != null ? String(data.weight_kg) : '')
        }
        setLoading(false)
      })
  }, [id, isEdit])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const weightNum = weightKg.trim() !== '' ? Number(weightKg) : null
    if (weightNum !== null && (Number.isNaN(weightNum) || weightNum <= 0)) {
      setError('Вес должен быть положительным числом.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      full_name: fullName.trim(),
      birth_date: birthDate || null,
      contact_info: contactInfo.trim() || null,
      weight_kg: weightNum,
    }

    const result =
      isEdit && id
        ? await supabase.from('patients').update(payload).eq('id', id).select('id').single()
        : await supabase
            .from('patients')
            .insert({ ...payload, doctor_id: session?.user.id })
            .select('id')
            .single()

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    navigate(`/doctor/patients/${result.data!.id}`)
  }

  if (loading) {
    return <p className="muted">Загрузка…</p>
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>{isEdit ? 'Редактировать пациента' : 'Новый пациент'}</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="full_name">ФИО</label>
          <input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="birth_date">Дата рождения</label>
          <input
            id="birth_date"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="contact_info">Контактные данные</label>
          <input
            id="contact_info"
            placeholder="Телефон, email…"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="weight_kg">Вес, кг</label>
          <input
            id="weight_kg"
            type="number"
            step="0.1"
            min="0"
            placeholder="Используется по умолчанию в расчёте дозировки"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
