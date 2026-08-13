import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Patient } from '../../types/patient'

export default function PatientsListPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
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

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Картотека пациентов</h1>
        <Link className="btn" to="/doctor/patients/new">
          + Добавить пациента
        </Link>
      </div>

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
