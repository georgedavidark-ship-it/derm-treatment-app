// Итоговая дозировка = вес пациента (кг) × дозировка на кг веса (мг/кг),
// см. SPEC.md, раздел 4 (prescriptions) и раздел 5.
export function calculateDosage(weightKg: number, mgPerKg: number): number {
  return Math.round(weightKg * mgPerKg * 100) / 100
}

// Длительность курса = целевая кумулятивная доза (мг) ÷ выбранная суточная
// доза (мг/сутки) ÷ 7, округление вверх (см. SPEC.md, раздел 5).
export function calculateCourseDurationWeeks(
  targetCumulativeDoseMg: number,
  dailyDoseMg: number,
): number {
  return Math.ceil(targetCumulativeDoseMg / dailyDoseMg / 7)
}
