import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Patient } from '../../types/patient'
import { downloadCsv } from '../../lib/exportCsv'

interface PrescriptionExportRow {
  calculated_dosage: number
  manual_dosage: number | null
  start_date: string
  status: 'active' | 'completed'
  patients: { full_name: string } | null
  drugs: { name: string } | null
  dosage_schemes: { name: string } | null
}

export default function PatientsListPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [exportingPatients, setExportingPatients] = useState(false)
  const [exportingPrescriptions, setExportingPrescriptions] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadPatients()
  }, [])

  async function loadPatients() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setPatients(data ?? [])
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return patients
    return patients.filter((p) => p.full_name.toLowerCase().includes(q))
  }, [patients, search])

  async function handleExportPatients() {
    setExportingPatients(true)
    setExportError(null)
    const { data, error } = await supabase.from('patients').select('*').order('full_name')
    setExportingPatients(false)

    if (error) {
      setExportError(error.message)
      return
    }

    downloadCsv(
      'пациенты.csv',
      ['ФИО', 'Дата рождения', 'Вес, кг', 'Контакты', 'Создан'],
      (data ?? []).map((p) => ({
        'ФИО': p.full_name,
        'Дата рождения': p.birth_date ?? '',
        'Вес, кг': p.weight_kg ?? '',
        'Контакты': p.contact_info ?? '',
        'Создан': new Date(p.created_at).toLocaleDateString('ru-RU'),
      })),
    )
  }

  async function handleExportPrescriptions() {
    setExportingPrescriptions(true)
    setExportError(null)
    const { data, error } = await supabase
      .from('prescriptions')
      .select(
        'calculated_dosage, manual_dosage, start_date, status, patients(full_name), drugs(name), dosage_schemes(name)',
      )
      .order('start_date', { ascending: false })
    setExportingPrescriptions(false)

    if (error) {
      setExportError(error.message)
      return
    }

    const rows = (data as unknown as PrescriptionExportRow[] | null) ?? []
    downloadCsv(
      'назначения.csv',
      ['Пациент', 'Препарат', 'Схема дозирования', 'Дозировка, мг/сутки', 'Дата начала', 'Статус'],
      rows.map((pr) => ({
        'Пациент': pr.patients?.full_name ?? '',
        'Препарат': pr.drugs?.name ?? '',
        'Схема дозирования': pr.dosage_schemes?.name ?? '',
        'Дозировка, мг/сутки': pr.manual_dosage ?? pr.calculated_dosage,
        'Дата начала': new Date(pr.start_date).toLocaleDateString('ru-RU'),
        'Статус': pr.status === 'active' ? 'Активно' : 'Завершено',
      })),
    )
  }

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Картотека пациентов</h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn secondary" onClick={handleExportPatients} disabled={exportingPatients}>
            {exportingPatients ? 'Экспортируем…' : 'Экспорт пациентов'}
          </button>
          <button className="btn secondary" onClick={handleExportPrescriptions} disabled={exportingPrescriptions}>
            {exportingPrescriptions ? 'Экспортируем…' : 'Экспорт назначений'}
          </button>
          <Link className="btn" to="/doctor/patients/new">
            + Добавить пациента
          </Link>
        </div>
      </div>

      {exportError && <p className="error-text">{exportError}</p>}

      <input
        className="search-input"
        placeholder="Поиск по имени…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card" style={{ marginTop: 16 }}>
        {loading && <p className="muted">Загрузка…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="muted">Пациенты не найдены.</p>
        )}
        {!loading && !error && filtered.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Дата рождения</th>
                <th>Контакты</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="clickable"
                  onClick={() => navigate(`/doctor/patients/${p.id}`)}
                >
                  <td>{p.full_name}</td>
                  <td>{p.birth_date ?? '—'}</td>
                  <td>{p.contact_info ?? '—'}</td>
                  <td>{new Date(p.created_at).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
