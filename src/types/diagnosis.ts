// Список специализирован под кожные заболевания (см. SPEC.md, раздел 5).
// "Другое" открывает свободное поле ввода для диагноза вне списка.
export const DIAGNOSIS_TYPES = [
  'Псориаз',
  'Атопический дерматит',
  'Экзема',
  'Акне',
  'Розацеа',
  'Себорейный дерматит',
  'Контактный дерматит',
  'Крапивница',
  'Витилиго',
  'Грибковое поражение кожи',
  'Другое',
] as const

export interface Diagnosis {
  id: string
  patient_id: string
  diagnosis_type: string
  diagnosed_at: string
  notes: string | null
  created_at: string
}

export type DiagnosisInput = Pick<Diagnosis, 'diagnosis_type' | 'diagnosed_at' | 'notes'>
