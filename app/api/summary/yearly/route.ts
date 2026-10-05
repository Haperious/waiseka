import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium, historyWindowStart } from '@/lib/tier'
import { MONTH_LABELS } from '@/lib/constants'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'
import { primaryCurrencyOf, viewCurrencyFrom, withCurrencyScope } from '@/lib/services/currencyScope'

export interface MonthlySummary {
  month: string
  income: number
  expenses: number
  savings: number
}

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))

  const db = await getDb()

  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) as never })
  const userIsPremium = user ? isPremium(user) : false
  const primary = primaryCurrencyOf(user)
  const currency = viewCurrencyFrom(searchParams, primary)

  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd   = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

  let effectiveStart = yearStart
  if (!userIsPremium) {
    const freeWindowStart = historyWindowStart(false)
    if (freeWindowStart > yearStart) {
      effectiveStart = freeWindowStart
    }
  }

  // Single aggregation: group by month and transaction type. Transfers flagged
  // countsAsSavings are bucketed as savings, matching /api/summary.
  const rows = await db.collection<ITransaction>('transactions').aggregate([
    {
      $match: withCurrencyScope({
        userId: session.user.id,
        date: { $gte: effectiveStart, $lte: yearEnd },
      }, currency, primary),
    },
    {
      $group: {
        _id: {
          month: { $month: '$date' },
          type: {
            $cond: [
              { $and: [{ $eq: ['$type', 'transfer'] }, { $eq: ['$countsAsSavings', true] }] },
              'savings',
              '$type',
            ],
          },
        },
        total: { $sum: '$amount' },
      },
    },
  ]).toArray()

  // Build a 12-slot result array, defaulting to zero
  const result: MonthlySummary[] = MONTH_LABELS.map((label) => ({
    month: label,
    income: 0,
    expenses: 0,
    savings: 0,
  }))

  for (const row of rows) {
    const monthIndex = (row._id.month as number) - 1 // $month is 1-based
    const type       = row._id.type as string
    const total      = row.total as number

    if (monthIndex < 0 || monthIndex > 11) continue

    if (type === 'income')  result[monthIndex].income   = total
    if (type === 'expense') result[monthIndex].expenses = total
    if (type === 'savings') result[monthIndex].savings  = total
  }

  return NextResponse.json(result)
}
