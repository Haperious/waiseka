import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { resolveCutoffPeriod, cutoffPrefsFor } from '@/lib/services/cutoff'
import { primaryCurrencyOf, viewCurrencyFrom, withCurrencyScope } from '@/lib/services/currencyScope'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'

/** GET /api/summary/cutoff?currency= - current pay-cutoff period and safe-to-spend, for one currency (default: primary). */
export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()

  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { preferences: 1 } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const primary = primaryCurrencyOf(user)
  const currency = viewCurrencyFrom(req.nextUrl.searchParams, primary)
  // Each currency can have its own pay schedule (e.g. QAR monthly, PHP semi-monthly)
  const period = resolveCutoffPeriod(cutoffPrefsFor(user.preferences, currency), new Date())

  const col = db.collection<ITransaction>('transactions')
  const [totals] = await col.aggregate([
    {
      $match: withCurrencyScope({
        userId: session.user.id,
        date: { $gte: period.start, $lte: period.end },
      }, currency, primary),
    },
    {
      $group: {
        _id: null,
        income: {
          $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
        },
        expenses: {
          $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
        },
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
  ]).toArray()

  const income = totals?.income ?? 0
  const expenses = totals?.expenses ?? 0
  const savings = totals?.savings ?? 0
  const unspent = income - expenses - savings
  const safeToSpendPerDay = period.daysLeft > 0 ? unspent / period.daysLeft : 0

  return NextResponse.json({
    period: {
      index: period.index,
      label: period.label,
      start: period.start,
      end: period.end,
      daysTotal: period.daysTotal,
      daysLeft: period.daysLeft,
    },
    income,
    expenses,
    savings,
    unspent,
    safeToSpendPerDay,
    sweldoLandedAt: period.start,
  })
}
