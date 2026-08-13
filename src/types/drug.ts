export interface Drug {
  id: string
  doctor_id: string
  name: string
  created_at: string
}

export interface DosageScheme {
  id: string
  drug_id: string
  name: string
  mg_per_kg: number
  created_at: string
}

export interface CumulativeDoseOption {
  id: string
  drug_id: string
  name: string
  max_cumulative_dose_mg_per_kg: number
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
