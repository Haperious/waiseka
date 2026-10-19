/**
 * Paydays (the 15th and the last day of each month) after `today`, up to and
 * including `target`. Used to spread a goal over the sweldos left before its deadline.
 */
export function countCutoffsUntil(target: Date, today = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  let count = 0
  const month = new Date(start.getFullYear(), start.getMonth(), 1)
  while (month <= end) {
    const y = month.getFullYear()
    const m = month.getMonth()
    for (const payday of [new Date(y, m, 15), new Date(y, m + 1, 0)]) {
      if (payday > start && payday <= end) count++
    }
    month.setMonth(m + 1)
  }
  return count
}
