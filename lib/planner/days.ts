/*
 * yyyy-MM-dd calendar-day maths for the Planner. Days are plain strings, so they compare
 * with < and > and never shift with the viewer's timezone. Worked out at UTC noon.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000

const toDate = (day: string) => new Date(`${day}T12:00:00.000Z`)
const toDay = (date: Date) => date.toISOString().slice(0, 10)

/** True for a real calendar day like 2026-11-30 (no Feb 30, no month 13). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY.test(value)) return false
  const date = toDate(value)
  if (Number.isNaN(date.getTime()) || toDay(date) !== value) return false
  const year = Number(value.slice(0, 4))
  return year >= 1900 && year <= 2200
}

export function addDays(day: string, n: number): string {
  return toDay(new Date(toDate(day).getTime() + n * MS_PER_DAY))
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / MS_PER_DAY)
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

/** Last day of the month `day` is in. */
export function monthEnd(day: string): string {
  const y = Number(day.slice(0, 4))
  const m0 = Number(day.slice(5, 7)) - 1
  return toDay(new Date(Date.UTC(y, m0, daysInMonth(y, m0), 12)))
}

/** Same day `n` months later, clamped to the month's length (Jan 31 + 1 = Feb 28). */
export function addMonths(day: string, n: number): string {
  const y = Number(day.slice(0, 4))
  const m0 = Number(day.slice(5, 7)) - 1 + n
  const d = Number(day.slice(8, 10))
  const year = y + Math.floor(m0 / 12)
  const month0 = ((m0 % 12) + 12) % 12
  return toDay(new Date(Date.UTC(year, month0, Math.min(d, daysInMonth(year, month0)), 12)))
}

/** Months from `from`'s month to `to`'s month (Nov -> Jan = 2). */
export function monthsBetween(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7))
}

/** Day-of-month `dayOfMonth` in the month `day` is in, clamped (31 in November = Nov 30). */
export function dayInMonth(day: string, dayOfMonth: number): string {
  const y = Number(day.slice(0, 4))
  const m0 = Number(day.slice(5, 7)) - 1
  return toDay(new Date(Date.UTC(y, m0, Math.min(Math.max(1, dayOfMonth), daysInMonth(y, m0)), 12)))
}

/** Today as yyyy-MM-dd in the viewer's own timezone (browser only). */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "Nov 30" / "Nov 30, 2027" when it isn't this year. */
export function formatDay(day: string, today?: string): string {
  const sameYear = today ? today.slice(0, 4) === day.slice(0, 4) : true
  return toDate(day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC',
  })
}

/** "Dec" for a carried-over scenario's name. */
export function monthLabel(day: string): string {
  return toDate(day).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}
