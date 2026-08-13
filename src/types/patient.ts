export interface Patient {
  id: string
  doctor_id: string
  full_name: string
  birth_date: string | null
  contact_info: string | null
  weight_kg: number | null
  access_token: string
  created_at: string
}

export type PatientInput = Pick<Patient, 'full_name' | 'birth_date' | 'contact_info' | 'weight_kg'>
