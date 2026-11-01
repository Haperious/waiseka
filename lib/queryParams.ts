/*
 * Query-string numbers for report and budget reads. parseInt('abc') is NaN, which turned
 * into an Invalid Date range that quietly matched nothing; ?month=13 rolled into the next
 * year. Anything unreadable now falls back to the current month or year.
 */

const MIN_YEAR = 1900
const MAX_YEAR = 2200

/** A whole number written in plain digits, or null ("12abc", "1e3", "" are not). */
function readInt(raw: string | null): number | null {
  if (raw === null || !/^\s*\d{1,6}\s*$/.test(raw)) return null
  return Number(raw)
}

/** `?year=` within sane bounds, else the current UTC year. */
export function readYear(searchParams: URLSearchParams, now = new Date()): number {
  const year = readInt(searchParams.get('year'))
  return year !== null && year >= MIN_YEAR && year <= MAX_YEAR ? year : now.getUTCFullYear()
}

/** `?month=` (1-12) and `?year=`, each falling back to now's (UTC) when missing or invalid. */
export function readMonthYear(searchParams: URLSearchParams, now = new Date()): { month: number; year: number } {
  const month = readInt(searchParams.get('month'))
  return {
    month: month !== null && month >= 1 && month <= 12 ? month : now.getUTCMonth() + 1,
    year: readYear(searchParams, now),
  }
}
