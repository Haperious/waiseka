import { MONTH_LABELS } from '@/lib/constants'
import type { RangeReport } from '@/lib/services/monthlyStats'
import type { YearReport, YoyReport } from '@/lib/services/yearReport'

/*
 * CSV bodies for /api/summary/export, one per /reports range. Amounts are in a single
 * currency (never converted), named in each section's first header cell.
 */

type Cell = string | number | null | undefined

export function escapeCsvField(value: Cell): string {
  if (value === null || value === undefined) return ''
  let str = String(value)
  // Text that starts like a formula (a category named "=HYPERLINK(...)") would run when the
  // file is opened in Excel or Sheets; a leading apostrophe makes it plain text. Numbers are
  // left alone, so a negative change still exports as a number.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) str = `'${str}`
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(sections: Cell[][][]): string {
  return sections
    .map((rows) => rows.map((row) => row.map(escapeCsvField).join(',')).join('\n'))
    .join('\n\n')
}

const round2 = (v: number) => Math.round(v * 100) / 100

export function rangeReportCsv(report: RangeReport, currency: string): string {
  const monthLabels = report.months.map((m) => m.label)
  return toCsv([
    [
      [`Metric (${currency})`, ...monthLabels, 'Total'],
      ['Income', ...report.months.map((m) => m.income), report.totals.income],
      ['Expenses', ...report.months.map((m) => m.expenses), report.totals.expenses],
      ['Savings', ...report.months.map((m) => m.savings), report.totals.savings],
      ['Leftover', ...report.months.map((m) => m.leftover), report.totals.leftover],
      ['Savings Rate %', ...report.months.map((m) => m.savingsRate), report.totals.savingsRate],
    ],
    [
      [`Category (${currency})`, ...monthLabels, '3-mo Avg', 'vs Avg %'],
      ...report.categories.map((c) => [c.name, ...c.byMonth, round2(c.average), c.currentVsAverage]),
    ],
  ])
}

export function yearReportCsv(report: YearReport, currency: string): string {
  // Months that haven't started yet are left blank rather than reported as 0
  const covered = <T>(values: T[]) => values.map((v, i) => (i < report.monthsCovered ? v : ''))
  // Same divisor as the page's averages: months with any activity
  const divisor = Math.max(1, report.monthsWithData)
  return toCsv([
    [
      [`Metric (${currency})`, ...MONTH_LABELS, 'Total'],
      ['Income', ...covered(report.months.map((m) => m.income)), report.totals.income],
      ['Expenses', ...covered(report.months.map((m) => m.expenses)), report.totals.expenses],
      ['Savings', ...covered(report.months.map((m) => m.savings)), report.totals.savings],
      ['Leftover', ...covered(report.months.map((m) => m.leftover)), report.totals.leftover],
      ['Savings Rate %', ...covered(report.months.map((m) => m.savingsRate)), report.totals.savingsRate],
    ],
    [
      [`Category (${currency})`, ...MONTH_LABELS, 'Total', 'Monthly Avg', 'Share %'],
      ...report.categories.map((c) => [
        c.name, ...covered(c.byMonth), c.total, round2(c.total / divisor), c.share,
      ]),
    ],
  ])
}

export function yoyReportCsv(report: YoyReport, currency: string): string {
  const { previous: prev, current: curr } = report
  const pct = (a: number, b: number) => (a > 0 ? Math.round(((b - a) / a) * 100) : '')
  const metric = (label: string, a: number, b: number) => [label, a, b, b - a, pct(a, b)]
  const range = `Jan-${MONTH_LABELS[report.monthsCovered - 1]}`
  return toCsv([
    [
      [`Metric (${currency}, ${range})`, String(prev.year), String(curr.year), 'Change', 'Change %'],
      metric('Income', prev.totals.income, curr.totals.income),
      metric('Expenses', prev.totals.expenses, curr.totals.expenses),
      metric('Savings', prev.totals.savings, curr.totals.savings),
      metric('Leftover', prev.totals.leftover, curr.totals.leftover),
      // A rate's change is in percentage points, so there's no "change %"
      ['Savings Rate %', prev.totals.savingsRate, curr.totals.savingsRate, curr.totals.savingsRate - prev.totals.savingsRate, ''],
      metric('Avg Monthly Spend', prev.totals.avgMonthlySpend, curr.totals.avgMonthlySpend),
    ],
    [
      [`Category (${currency}, ${range})`, String(prev.year), String(curr.year), 'Change', 'Change %'],
      ...report.categoryChanges.map((c) => [c.name, c.previous, c.current, c.delta, c.pct ?? 'new']),
    ],
  ])
}
