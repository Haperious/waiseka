import { MONTH_LABELS } from '@/lib/constants'
import type { CategoryChange } from '@/lib/services/yearReport'
import type { MonthSummary } from '@/lib/services/monthlyStats'

/*
 * Pure view logic for /reports: URL params, labels and colour choices. No React, so
 * every rule the page shows can be unit tested on its own.
 */

export type ReportRange = '3m' | 'fy' | 'yoy'
export type ReportView = 'chart' | 'table'
export type YoyMetric = 'income' | 'expenses' | 'savings'
export type Tone = 'good' | 'bad' | 'flat'

export const RANGES: { value: ReportRange; label: string; premium: boolean }[] = [
  { value: '3m', label: 'Last 3 months', premium: false },
  { value: 'fy', label: 'Full year', premium: true },
  { value: 'yoy', label: 'Year-on-year', premium: true },
]

export const YOY_METRICS: { value: YoyMetric; label: string; color: string }[] = [
  { value: 'income', label: 'Income', color: 'var(--color-income)' },
  { value: 'expenses', label: 'Expenses', color: 'var(--color-expense)' },
  { value: 'savings', label: 'Savings', color: 'var(--color-savings)' },
]

export function parseRange(raw: string | null): ReportRange {
  return raw === 'fy' || raw === 'yoy' ? raw : '3m'
}

/** "Jan – Oct" for the first `months` months of a year. */
export function monthSpan(months: number): string {
  return `Jan – ${MONTH_LABELS[Math.min(12, Math.max(1, months)) - 1]}`
}

export function hasActivity(m: Pick<MonthSummary, 'income' | 'expenses' | 'savings'>): boolean {
  return m.income > 0 || m.expenses > 0 || m.savings > 0
}

/** Month label colour under the bar charts: current month accent, a low savings rate warns. */
export function rateLabelColor(rate: number, isCurrent: boolean): string {
  if (isCurrent) return 'var(--color-accent)'
  return rate < 15 ? 'var(--color-warning)' : 'var(--color-text-muted)'
}

/** Month-card savings rate colour. */
export function savingsRateColor(rate: number): string {
  return rate >= 20 ? 'var(--color-accent)' : rate >= 10 ? 'var(--color-warning)' : 'var(--color-text-muted)'
}

export const TONE_COLOR: Record<Tone, string> = {
  good: 'var(--color-income)',
  bad: 'var(--color-expense)',
  flat: 'var(--color-text-muted)',
}

export const TONE_BG: Record<Tone, string> = {
  good: 'var(--color-income-bg)',
  bad: 'var(--color-expense-bg)',
  flat: 'var(--color-elevated)',
}

/** "+5", "−5" (true minus sign), "0". */
export function signed(value: number, suffix = ''): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value)}${suffix}`
}

/** "+₱300" / "−₱300" / "₱0" - the sign outside the formatted amount. */
export function signedAmount(value: number, formatAmount: (v: number) => string): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatAmount(Math.abs(value))}`
}

/** Spending going up is bad; going down is good. */
export function spendTone(delta: number): Tone {
  return delta > 0 ? 'bad' : delta < 0 ? 'good' : 'flat'
}

/**
 * Year-on-year badge for a stat tile. `pts` compares percentages (savings rate) by
 * subtraction; otherwise it's a % change, which has no meaning when last year was 0.
 */
export function changeBadge(
  current: number,
  previous: number,
  higherIsGood: boolean,
  unit: '%' | 'pts'
): { text: string; tone: Tone } | null {
  let delta: number
  if (unit === 'pts') {
    delta = current - previous
  } else {
    if (previous === 0) return null
    delta = Math.round(((current - previous) / Math.abs(previous)) * 100)
  }
  const tone: Tone = delta === 0 ? 'flat' : (delta > 0) === higherIsGood ? 'good' : 'bad'
  return { text: signed(delta, unit === 'pts' ? ' pts' : '%'), tone }
}

/** The categories whose spending moved the most in money terms, biggest first. */
export function biggestChanges(changes: CategoryChange[], limit = 6): CategoryChange[] {
  return changes
    .filter((c) => c.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name))
    .slice(0, limit)
}

const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/** "on the same ten months last year" / "on the same month last year" / "on 2024". */
export function comparisonPeriod(monthsCovered: number, previousYear: number): string {
  if (monthsCovered >= 12) return `on ${previousYear}`
  if (monthsCovered <= 1) return 'on the same month last year'
  return `on the same ${NUMBER_WORDS[monthsCovered - 1]} months last year`
}

/** Whole number with thousands separators and no currency symbol, for dense tables. */
export function plainNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}
