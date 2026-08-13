import { useParams } from 'react-router-dom'

export default function PatientPage() {
  const { token } = useParams<{ token: string }>()

  return (
    <div className="page">
      <div className="card">
        <h1>Личный кабинет пациента</h1>
        <p className="muted">
          Токен: <code>{token}</code>
        </p>
        <p>Эта страница будет реализована на шаге 6 плана MVP.</p>
      </div>
    </div>
  )
}
