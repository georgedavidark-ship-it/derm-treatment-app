import { Navigate, Route, Routes } from 'react-router-dom'
import DoctorLayout from './pages/doctor/DoctorLayout'
import LoginPage from './pages/doctor/LoginPage'
import PatientsListPage from './pages/doctor/PatientsListPage'
import PatientFormPage from './pages/doctor/PatientFormPage'
import PatientDetailPage from './pages/doctor/PatientDetailPage'
import DrugsPage from './pages/doctor/DrugsPage'
import PatientPage from './pages/patient/PatientPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/doctor" replace />} />

      <Route path="/doctor/login" element={<LoginPage />} />
      <Route path="/doctor" element={<DoctorLayout />}>
        <Route index element={<PatientsListPage />} />
        <Route path="patients/new" element={<PatientFormPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="patients/:id/edit" element={<PatientFormPage />} />
        <Route path="drugs" element={<DrugsPage />} />
      </Route>

      <Route path="/patient/:token" element={<PatientPage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
