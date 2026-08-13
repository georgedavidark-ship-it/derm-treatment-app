import { Navigate, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export default function DoctorLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Загрузка…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/doctor/login" replace />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <nav>
          <Link to="/doctor">Пациенты</Link>
          <Link to="/doctor/drugs">Препараты</Link>
        </nav>
        <div>
          <span className="muted" style={{ marginRight: 12 }}>
            {session.user.email}
          </span>
          <button className="btn secondary" onClick={() => supabase.auth.signOut()}>
            Выйти
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
