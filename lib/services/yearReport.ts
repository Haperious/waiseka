import type { Db } from 'mongodb'
import type { ITransaction } from '@/lib/models/Transaction'
import { historyWindowStart } from '@/lib/tier'
import { monthsCoveredIn, selectableYears, type YearReportMode } from '@/lib/reportYears'
import {
  aggregateExpensesByCategoryAndMonth,
  aggregateMonthlyTotals,
  monthMeta,
  resolveCategoryColors,
  savingsRate,
  summarizeMonth,
  userCategoryColors,
  type CategoryMonthRow,
  type MonthlyTotalsRow,
  type MonthSummary,
  type ScopeFilter,
} from '@/lib/services/monthlyStats'

/*
 * Full-year and year-on-year reports (Premium) for /reports. Everything is UTC calendar
 * months, like the 3-month report. The DB functions at the bottom only fetch; the pure
 * builders above them do all the maths so they can be tested without a database.
 */

export interface YearTotals {
  income: number
  expenses: number
  savings: number
  leftover: number
  savingsRate: number
  /** Expenses over the months that have any activity, rounded to the nearest 10. */
  avgMonthlySpend: number
}

export interface YearCategory {
  name: string
  color: string
  /** 12 slots, Jan-Dec; months after `monthsCovered` are 0. */
  byMonth: number[]
  total: number
  /** Whole-number % of the year's category spend. */
  share: number
  /** 0-based month with the highest spend (earliest on a tie). */
  peakMonth: number
  /** Spent the same nonzero amount in every month it appears, at least twice (rent, subscriptions). */
  isFixed: boolean
}

export interface AvailableYear {
  year: number
  hasData: boolean
}

export interface YearReport {
  year: number
  /** Months of `year` that have started: 12 for a past year, Jan..current month for this year. */
  monthsCovered: number
  /** Covered months with any income, expenses or savings. */
  monthsWithData: number
  /** Always 12, Jan-Dec. */
  months: MonthSummary[]
  /** Sorted by total, highest first. */
  categories: YearCategory[]
  totals: YearTotals
  availableYears: AvailableYear[]
  /** Earliest year in the history window with any activity, or null for none. */
  firstYearWithData: number | null
}

export interface YearSide {
  year: number
  /** `monthsCovered` long, Jan first. */
  months: MonthSummary[]
  totals: YearTotals
}

export interface CategoryChange {
  name: string
  color: string
  previous: number
  current: number
  delta: number
  /** Whole-number % change, or null when there was no spend last year (a new category). */
  pct: number | null
}

export interface YoyReport {
  year: number
  previousYear: number
  /** Both years cover Jan..this many months, so the comparison is like for like. */
  monthsCovered: number
  current: YearSide
  previous: YearSide
  /** Sorted by this year's spend, highest first. */
  categoryChanges: CategoryChange[]
  availableYears: AvailableYear[]
  firstYearWithData: number | null
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function computeYearTotals(months: MonthSummary[]): YearTotals {
  const income = months.reduce((s, m) => s + m.income, 0)
  const expenses = months.reduce((s, m) => s + m.expenses, 0)
  const savings = months.reduce((s, m) => s + m.savings, 0)
  const activeMonths = months.filter(hasActivity).length
  return {
    income,
    expenses,
    savings,
    leftover: income - expenses,
    savingsRate: savingsRate(income, expenses, savings),
    avgMonthlySpend: activeMonths ? Math.round(expenses / activeMonths / 10) * 10 : 0,
  }
}

function hasActivity(m: MonthSummary): boolean {
  return m.income > 0 || m.expenses > 0 || m.savings > 0
}

/** Same nonzero amount in every month it shows up, and it shows up at least twice. */
export function isFixedSpend(byMonth: number[]): boolean {
  const nonzero = byMonth.filter((v) => v > 0)
  return nonzero.length >= 2 && nonzero.every((v) => v === nonzero[0])
}

/** The 12 months of `year` (only the first `monthsCovered` keep their totals). */
function yearMonths(year: number, monthsCovered: number, totals: MonthlyTotalsRow[]): MonthSummary[] {
  const byMonth = new Map(totals.filter((r) => r.year === year).map((r) => [r.month, r]))
  return Array.from({ length: 12 }, (_, i) => {
    const meta = monthMeta(year, i + 1)
    return summarizeMonth(meta, i < monthsCovered ? byMonth.get(i + 1) : undefined)
  })
}

/** category -> 12 monthly totals for `year`, dropping months past `monthsCovered`. */
function categoryMonthMap(rows: CategoryMonthRow[], year: number, monthsCovered: number): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (const row of rows) {
    if (row.year !== year || row.month < 1 || row.month > monthsCovered) continue
    if (!map.has(row.category)) map.set(row.category, new Array(12).fill(0))
    map.get(row.category)![row.month - 1] += row.total
  }
  return map
}

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0)

/** Year-report categories, sorted by total. `userColors` are the user's own category colours. */
export function buildYearCategories(
  rows: CategoryMonthRow[],
  year: number,
  monthsCovered: number,
  userColors: Map<string, string>
): YearCategory[] {
  const map = categoryMonthMap(rows, year, monthsCovered)
  const entries = [...map.entries()]
    .map(([name, byMonth]) => ({ name, byMonth, total: sum(byMonth) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  const grandTotal = sum(entries.map((c) => c.total))
  const palette = resolveCategoryColors(entries.map((c) => c.name), userColors)
  return entries.map((c, i) => ({
    name: c.name,
    color: palette[i],
    byMonth: c.byMonth,
    total: c.total,
    share: grandTotal > 0 ? Math.round((c.total / grandTotal) * 100) : 0,
    peakMonth: c.byMonth.indexOf(Math.max(...c.byMonth)),
    isFixed: isFixedSpend(c.byMonth),
  }))
}

export function assembleYearReport(input: {
  year: number
  now: Date
  totals: MonthlyTotalsRow[]
  categories: CategoryMonthRow[]
  userColors: Map<string, string>
  availableYears: AvailableYear[]
}): YearReport {
  const monthsCovered = monthsCoveredIn(input.year, input.now)
  const months = yearMonths(input.year, monthsCovered, input.totals)
  return {
    year: input.year,
    monthsCovered,
    monthsWithData: months.filter(hasActivity).length,
    months,
    categories: buildYearCategories(input.categories, input.year, monthsCovered, input.userColors),
    totals: computeYearTotals(months),
    availableYears: input.availableYears,
    firstYearWithData: firstYearWithData(input.availableYears),
  }
}

/** Per-category spend this year vs the same months last year, sorted by this year's spend. */
export function buildCategoryChanges(
  rows: CategoryMonthRow[],
  year: number,
  monthsCovered: number,
  userColors: Map<string, string>
): CategoryChange[] {
  const current = categoryMonthMap(rows, year, monthsCovered)
  const previous = categoryMonthMap(rows, year - 1, monthsCovered)
  const names = new Set([...current.keys(), ...previous.keys()])
  const entries = [...names]
    .map((name) => {
      const curr = sum(current.get(name) ?? [])
      const prev = sum(previous.get(name) ?? [])
      return { name, current: curr, previous: prev }
    })
    .filter((c) => c.current > 0 || c.previous > 0)
    .sort((a, b) => b.current - a.current || b.previous - a.previous || a.name.localeCompare(b.name))
  const palette = resolveCategoryColors(entries.map((c) => c.name), userColors)
  return entries.map((c, i) => {
    const delta = c.current - c.previous
    return {
      ...c,
      color: palette[i],
      delta,
      pct: c.previous > 0 ? Math.round((delta / c.previous) * 100) : null,
    }
  })
}

export function assembleYoyReport(input: {
  year: number
  now: Date
  totals: MonthlyTotalsRow[]
  categories: CategoryMonthRow[]
  userColors: Map<string, string>
  availableYears: AvailableYear[]
}): YoyReport {
  const monthsCovered = monthsCoveredIn(input.year, input.now)
  const side = (year: number): YearSide => {
    const months = yearMonths(year, monthsCovered, input.totals).slice(0, monthsCovered)
    return { year, months, totals: computeYearTotals(months) }
  }
  return {
    year: input.year,
    previousYear: input.year - 1,
    monthsCovered,
    current: side(input.year),
    previous: side(input.year - 1),
    categoryChanges: buildCategoryChanges(input.categories, input.year, monthsCovered, input.userColors),
    availableYears: input.availableYears,
    firstYearWithData: firstYearWithData(input.availableYears),
  }
}

function firstYearWithData(years: AvailableYear[]): number | null {
  const withData = years.filter((y) => y.hasData).map((y) => y.year)
  return withData.length ? Math.min(...withData) : null
}

// ── Database ──────────────────────────────────────────────────────────────────

/** Calendar years (UTC) in [start, end] with at least one transaction in scope. */
export async function aggregateYearsWithData(
  db: Db,
  userId: string,
  start: Date,
  end: Date,
  scope?: ScopeFilter
): Promise<number[]> {
  // A year holding only balance adjustments has nothing to report
  const match: Record<string, unknown> = { userId, isArchived: { $ne: true }, type: { $ne: 'adjustment' }, date: { $gte: start, $lte: end } }
  if (scope) match.$and = [scope]
  const rows = await db.collection<ITransaction>('transactions').aggregate<{ _id: number }>([
    { $match: match },
    { $group: { _id: { $year: '$date' } } },
  ]).toArray()
  return rows.map((r) => r._id)
}

/** Clamp to the tier's history window - nothing older may be reported on. */
function rangeStart(year: number, premium: boolean, now: Date): Date {
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const windowStart = historyWindowStart(premium, now)
  return windowStart > yearStart ? windowStart : yearStart
}

function coveredEnd(year: number, now: Date): Date {
  return monthMeta(year, Math.max(1, monthsCoveredIn(year, now))).end
}

async function loadAvailableYears(
  db: Db, userId: string, premium: boolean, now: Date, mode: YearReportMode, scope: ScopeFilter
): Promise<AvailableYear[]> {
  const years = selectableYears(premium, now, 'fy')
  const withData = new Set(await aggregateYearsWithData(
    db, userId, historyWindowStart(premium, now), coveredEnd(years[0], now), scope
  ))
  const offered = mode === 'yoy' ? selectableYears(premium, now, 'yoy') : years
  return offered.map((year) => ({ year, hasData: withData.has(year) }))
}

/** `year` must already be validated with parseReportYear(..., 'fy'). */
export async function buildYearReport(
  db: Db, userId: string, year: number, premium: boolean, scope: ScopeFilter, now: Date = new Date()
): Promise<YearReport> {
  const start = rangeStart(year, premium, now)
  const end = coveredEnd(year, now)
  const [totals, categories, availableYears] = await Promise.all([
    aggregateMonthlyTotals(db, userId, start, end, scope),
    aggregateExpensesByCategoryAndMonth(db, userId, start, end, scope),
    loadAvailableYears(db, userId, premium, now, 'fy', scope),
  ])
  const userColors = await userCategoryColors(db, userId, [...new Set(categories.map((r) => r.category))])
  return assembleYearReport({
    year, now, totals, categories, availableYears, userColors,
  })
}

/** `year` must already be validated with parseReportYear(..., 'yoy'). */
export async function buildYoyReport(
  db: Db, userId: string, year: number, premium: boolean, scope: ScopeFilter, now: Date = new Date()
): Promise<YoyReport> {
  // One pass over both years; assembleYoyReport drops last year's months past the cutoff
  const start = rangeStart(year - 1, premium, now)
  const end = coveredEnd(year, now)
  const [totals, categories, availableYears] = await Promise.all([
    aggregateMonthlyTotals(db, userId, start, end, scope),
    aggregateExpensesByCategoryAndMonth(db, userId, start, end, scope),
    loadAvailableYears(db, userId, premium, now, 'yoy', scope),
  ])
  const userColors = await userCategoryColors(db, userId, [...new Set(categories.map((r) => r.category))])
  return assembleYoyReport({
    year, now, totals, categories, availableYears, userColors,
  })
}
