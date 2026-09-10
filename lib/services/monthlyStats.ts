import { Db } from 'mongodb'
import type { ITransaction } from '@/lib/models/Transaction'
import type { ICategory } from '@/lib/models/Category'

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export interface MonthMeta {
  year: number
  /** 1-based. */
  month: number
  key: string
  label: string
  start: Date
  end: Date
}

/** Boundaries + label for a single calendar month, UTC. */
export function monthMeta(year: number, month1: number): MonthMeta {
  const start = new Date(Date.UTC(year, month1 - 1, 1))
  const end = new Date(Date.UTC(year, month1, 0, 23, 59, 59, 999))
  return { year, month: month1, key: `${year}-${month1}`, label: MONTH_LABELS[month1 - 1], start, end }
}

/**
 * `count` consecutive calendar months ending at `from`'s month, oldest first.
 * `monthsBack(d, 3)` where `d` is September returns [Jul, Aug, Sep].
 */
export function monthsBack(from: Date, count: number): MonthMeta[] {
  const months: MonthMeta[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1))
    months.push(monthMeta(d.getUTCFullYear(), d.getUTCMonth() + 1))
  }
  return months
}

export interface CategoryMonthRow {
  category: string
  year: number
  month: number
  total: number
}

/** Per-category, per-month expense totals over [start, end]. */
export async function aggregateExpensesByCategoryAndMonth(
  db: Db,
  userId: string,
  start: Date,
  end: Date
): Promise<CategoryMonthRow[]> {
  const col = db.collection<ITransaction>('transactions')
  const rows = await col.aggregate<{ category: string; year: number; month: number; total: number }>([
    {
      $match: {
        userId,
        type: 'expense',
        isArchived: { $ne: true },
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: { category: '$category', year: { $year: '$date' }, month: { $month: '$date' } },
        total: { $sum: '$amount' },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id.category',
        year: '$_id.year',
        month: '$_id.month',
        total: 1,
      },
    },
  ]).toArray()
  return rows
}

export interface MonthlyTotalsRow {
  year: number
  month: number
  income: number
  expenses: number
  savings: number
}

/** Per-month income/expenses/savings totals over [start, end]. */
export async function aggregateMonthlyTotals(
  db: Db,
  userId: string,
  start: Date,
  end: Date
): Promise<MonthlyTotalsRow[]> {
  const col = db.collection<ITransaction>('transactions')
  const rows = await col.aggregate<{ year: number; month: number; income: number; expenses: number; savings: number }>([
    {
      $match: {
        userId,
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        savings: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$type', 'savings'] },
                  { $and: [{ $eq: ['$type', 'transfer'] }, { $eq: ['$countsAsSavings', true] }] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        year: '$_id.year',
        month: '$_id.month',
        income: 1,
        expenses: 1,
        savings: 1,
      },
    },
  ]).toArray()
  return rows
}

/** Simple mean of `amounts`, and how far `current` sits above/below it as a percentage. */
export function averageAndDelta(amounts: number[], current: number): { average: number; percentageAbove: number } {
  const average = amounts.length ? amounts.reduce((sum, v) => sum + v, 0) / amounts.length : 0
  const percentageAbove = average > 0 ? Math.round((current / average - 1) * 100) : 0
  return { average, percentageAbove }
}

export function savingsRate(income: number, expenses: number, savings: number): number {
  if (income <= 0) return 0
  return Math.round(((income - expenses + savings) / income) * 100)
}

export interface MonthSummary {
  key: string
  label: string
  income: number
  expenses: number
  savings: number
  leftover: number
  savingsRate: number
}

export interface CategoryRangeStats {
  name: string
  color: string
  byMonth: number[]
  average: number
  currentVsAverage: number
}

export interface RangeReport {
  months: MonthSummary[]
  categories: CategoryRangeStats[]
  movers: CategoryRangeStats[]
  totals: MonthSummary
}

/**
 * Ranks categories by how far their current month deviates from their own 3-month
 * average, for the dashboard's "biggest movers" band. A category needs at least 2
 * months of nonzero spend before it's eligible - one data point can't establish a
 * baseline, so a first-time category shouldn't headline as a "mover".
 */
export function selectBiggestMovers(categories: CategoryRangeStats[], limit = 6): CategoryRangeStats[] {
  return categories
    .filter((c) => c.byMonth.filter((v) => v > 0).length >= 2)
    .sort((a, b) => Math.abs(b.currentVsAverage) - Math.abs(a.currentVsAverage))
    .slice(0, limit)
}

const FALLBACK_COLORS = [
  '#166534', '#16A34A', '#4ADE80', '#84CC16',
  '#D97706', '#B45309', '#2563EB', '#7C3AED',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1',
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
]

/**
 * Assembles the per-month totals, per-category trend, and grand totals that back
 * both /api/summary/range and /api/summary/export - one aggregation pass, shared
 * by both consumers so their numbers can never drift apart.
 */
export async function buildRangeReport(db: Db, userId: string, months: MonthMeta[]): Promise<RangeReport> {
  const rangeStart = months[0].start
  const rangeEnd = months[months.length - 1].end

  const [totalsRows, categoryRows] = await Promise.all([
    aggregateMonthlyTotals(db, userId, rangeStart, rangeEnd),
    aggregateExpensesByCategoryAndMonth(db, userId, rangeStart, rangeEnd),
  ])

  const totalsByKey = new Map(totalsRows.map((r) => [`${r.year}-${r.month}`, r]))

  const monthSummaries: MonthSummary[] = months.map((m) => {
    const row = totalsByKey.get(m.key)
    const income = row?.income ?? 0
    const expenses = row?.expenses ?? 0
    const savings = row?.savings ?? 0
    return {
      key: m.key,
      label: m.label,
      income,
      expenses,
      savings,
      leftover: income - expenses,
      savingsRate: savingsRate(income, expenses, savings),
    }
  })

  const categoryByMonth = new Map<string, number[]>()
  for (const row of categoryRows) {
    const key = `${row.year}-${row.month}`
    const idx = months.findIndex((m) => m.key === key)
    if (idx === -1) continue
    if (!categoryByMonth.has(row.category)) categoryByMonth.set(row.category, new Array(months.length).fill(0))
    categoryByMonth.get(row.category)![idx] += row.total
  }

  const activeCategoryNames = Array.from(categoryByMonth.keys()).filter((name) =>
    categoryByMonth.get(name)!.some((v) => v > 0)
  )

  const categoryDocs = activeCategoryNames.length
    ? await db.collection<ICategory>('categories')
        .find({ userId, name: { $in: activeCategoryNames } })
        .project({ name: 1, color: 1 })
        .toArray()
    : []
  const colorMap = new Map(categoryDocs.filter((d) => d.color).map((d) => [d.name, d.color as string]))

  const sortedCategoryNames = activeCategoryNames.sort(
    (a, b) => categoryByMonth.get(b)!.reduce((s, v) => s + v, 0) - categoryByMonth.get(a)!.reduce((s, v) => s + v, 0)
  )

  const categories: CategoryRangeStats[] = sortedCategoryNames.map((name, i) => {
    const byMonth = categoryByMonth.get(name)!
    const currentMonthTotal = byMonth[byMonth.length - 1]
    const { average, percentageAbove } = averageAndDelta(byMonth, currentMonthTotal)
    return {
      name,
      color: colorMap.get(name) ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      byMonth,
      average,
      currentVsAverage: percentageAbove,
    }
  })

  const rawTotals = monthSummaries.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings,
    }),
    { income: 0, expenses: 0, savings: 0 }
  )

  const totals: MonthSummary = {
    key: 'total',
    label: 'Total',
    ...rawTotals,
    leftover: rawTotals.income - rawTotals.expenses,
    savingsRate: savingsRate(rawTotals.income, rawTotals.expenses, rawTotals.savings),
  }

  const movers = selectBiggestMovers(categories)

  return { months: monthSummaries, categories, movers, totals }
}
