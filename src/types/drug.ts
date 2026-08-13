export const SEVERITIES = [
  { value: 'mild', label: 'Лёгкая' },
  { value: 'moderate', label: 'Средняя' },
  { value: 'severe', label: 'Тяжёлая' },
] as const

export type Severity = (typeof SEVERITIES)[number]['value']

export interface Drug {
  id: string
  doctor_id: string
  name: string
  track_cumulative_dose: boolean
  max_cumulative_dose_mg_per_kg: number | null
  created_at: string
}

export interface DosageRule {
  id: string
  drug_id: string
  severity: Severity
  mg_per_kg_min: number
  mg_per_kg_max: number
  created_at: string
}

export interface ReleaseForm {
  id: string
  drug_id: string
  form_name: string
  unit_dose_mg: number
  units_per_package: number
  created_at: string
}
