// Текущая неделя лечения = сколько полных 7-дневных периодов прошло с даты
// начала курса, ограниченная длиной схемы по неделям (см. SPEC.md, раздел 6).
export function currentWeekNumber(startDate: string, totalWeeks: number): number {
  const start = new Date(`${startDate}T00:00:00`)
  const today = new Date()
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const daysElapsed = Math.floor((todayUtc - startUtc) / (1000 * 60 * 60 * 24))
  const week = Math.floor(daysElapsed / 7) + 1
  return Math.min(Math.max(week, 1), totalWeeks)
}
