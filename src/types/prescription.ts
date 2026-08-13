import type { Severity } from './drug'

export const PRESCRIPTION_STATUSES = [
  { value: 'active', label: 'Активно' },
  { value: 'completed', label: 'Завершено' },
] as const

export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number]['value']

export interface Prescription {
  id: string
  patient_id: string
  diagnosis_id: string | null
  drug_id: string
  weight_kg: number
  severity: Severity
  calculated_dosage: number
  manual_dosage: number | null
  start_date: string
  status: PrescriptionStatus
  created_at: string
}

export interface PrescriptionWeek {
  id: string
  prescription_id: string
  week_number: number
  dosage: number
  comment: string | null
}
