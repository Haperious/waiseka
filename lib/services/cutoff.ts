const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export interface CutoffPreferences {
  cutoffMode?: 'semi-monthly' | 'monthly' | 'custom'
  cutoffDays?: number[]
  cutoffAnchorDate?: string
}

export interface CutoffPeriod {
  /** 1-based index of this period within its calendar month. */
  index: number
  /** e.g. "16–30 Sep". Periods never cross a calendar-month boundary. */
  label: string
  /** Start of day, UTC. */
  start: Date
  /** End of day (23:59:59.999), UTC. */
  end: Date
  daysTotal: number
  /** Days remaining including `date` itself; 0 once `date` is past `end`. */
  daysLeft: number
}

const DEFAULT_CUTOFF_DAYS = [15, 30]

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

/**
 * Cutoff boundaries for a given calendar month, derived from the user's configured
 * cutoff days. Each configured day is clamped to the month's actual length (so "30"
 * resolves to 28/29 in February), and the month's last day is always included as a
 * boundary - this guarantees periods tile the whole month with no gap on 31-day
 * months and never cross into the next month.
 */
function boundariesForMonth(cutoffDays: number[], year: number, monthIndex0: number): number[] {
  const dim = daysInMonth(year, monthIndex0)
  const days = new Set<number>()
  for (const d of cutoffDays) {
    if (d < 1) continue
    // Day 30 (and 31) is a stand-in for "end of month" - it clamps down to 28/29
    // in February and extends up to the 31st in a 31-day month, rather than
    // leaving a stray 1-day period. Any other configured day is a literal
    // calendar day.
    days.add(d >= 30 ? dim : Math.min(d, dim))
  }
  days.add(dim) // guarantees full month coverage even for a single mid-month cutoff
  return Array.from(days).sort((a, b) => a - b)
}

function resolveCutoffDays(prefs: CutoffPreferences): number[] {
  const days = prefs.cutoffDays
  if (!days || days.length === 0) return DEFAULT_CUTOFF_DAYS
  return days
}

/**
 * Resolves the cutoff period (semi-monthly, monthly, or custom day-of-month cutoffs)
 * that `date` falls within. Pure function - no I/O, month-length aware.
 */
export function resolveCutoffPeriod(prefs: CutoffPreferences, date: Date): CutoffPeriod {
  const year = date.getUTCFullYear()
  const monthIndex0 = date.getUTCMonth()
  const day = date.getUTCDate()

  const cutoffDays = resolveCutoffDays(prefs)
  const boundaries = boundariesForMonth(cutoffDays, year, monthIndex0)

  let index = boundaries.findIndex((b) => day <= b)
  if (index === -1) index = boundaries.length - 1 // defensive: date.day > last boundary can't happen since last boundary = dim

  const endDay = boundaries[index]
  const startDay = index === 0 ? 1 : boundaries[index - 1] + 1

  const start = new Date(Date.UTC(year, monthIndex0, startDay, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, monthIndex0, endDay, 23, 59, 59, 999))

  const daysTotal = endDay - startDay + 1
  const daysLeft = Math.max(0, Math.min(daysTotal, endDay - day + 1))

  const label = `${startDay}–${endDay} ${MONTH_LABELS[monthIndex0]}`

  return { index: index + 1, label, start, end, daysTotal, daysLeft }
}
