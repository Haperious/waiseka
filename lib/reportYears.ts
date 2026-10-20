import { historyWindowStart } from '@/lib/tier'

/*
 * Which years a /reports full-year or year-on-year view may show. Pure and client-safe:
 * the API routes validate `?year=` with these, and the page uses them to keep the URL's
 * year in range before asking. Calendar years and months are UTC, like the reports.
 */

export type YearReportMode = 'fy' | 'yoy'

/** Months of `year` that have started by `now` (0 for a future year). */
export function monthsCoveredIn(year: number, now: Date): number {
  const nowYear = now.getUTCFullYear()
  if (year < nowYear) return 12
  if (year > nowYear) return 0
  return now.getUTCMonth() + 1
}

/**
 * Years a report can be asked for: the history window's first year through this year,
 * newest first. Year-on-year starts one later because it needs a previous year to compare.
 */
export function selectableYears(premium: boolean, now: Date, mode: YearReportMode): number[] {
  const first = historyWindowStart(premium, now).getUTCFullYear() + (mode === 'yoy' ? 1 : 0)
  const years: number[] = []
  for (let y = now.getUTCFullYear(); y >= first; y--) years.push(y)
  return years
}

export type ParsedYear = { ok: true; year: number } | { ok: false; error: string }

/** `?year=` for a report: defaults to this year; must be one of `selectableYears`. */
export function parseReportYear(raw: string | null, premium: boolean, now: Date, mode: YearReportMode): ParsedYear {
  const years = selectableYears(premium, now, mode)
  if (raw === null || raw === '') return { ok: true, year: years[0] }
  if (!/^\d{4}$/.test(raw)) return { ok: false, error: 'year must be a 4-digit year' }
  const year = Number(raw)
  if (!years.includes(year)) {
    return { ok: false, error: `year must be between ${years[years.length - 1]} and ${years[0]}` }
  }
  return { ok: true, year }
}
