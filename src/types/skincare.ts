export interface SkincareRoutine {
  id: string
  patient_id: string
  prescription_id: string | null
  week_number: number
  products_and_procedures: string | null
  instructions: string | null
  created_at: string
}
