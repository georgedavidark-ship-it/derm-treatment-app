export interface PatientPhoto {
  id: string
  patient_id: string
  storage_path: string
  note: string | null
  uploaded_by: 'doctor' | 'patient'
  uploaded_at: string
}
