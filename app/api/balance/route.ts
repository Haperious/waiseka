import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_HISTORY_DAYS, PREMIUM_HISTORY_DAYS } from '@/lib/constants'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'

/**
 * GET /api/balance
 *
 * Returns the all-time net balance (income − expenses) for the authenticated user.
 * Savings transactions are intentionally excluded- they are neutral (money set aside,
 * not spent or earned in the budget sense).
 *
 * Query params:
 *   upTo?: ISO date string- if provided, only transactions up to (and including)
 *          this date are counted. Used by the transactions page to anchor the
 *          running balance at a page boundary.
 *
 * Response:
 *   { balance, income, expenses, historyDays, restricted }
 *
 *   restricted: true when the user is on the free tier (balance reflects their
 *               capped history window, not all-time).
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const upToParam = searchParams.get('upTo')

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) as never })
  const userIsPremium = user ? isPremium(user) : false

  const historyDays = userIsPremium ? PREMIUM_HISTORY_DAYS : FREE_HISTORY_DAYS
  const windowStart = new Date()
  windowStart.setUTCDate(windowStart.getUTCDate() - historyDays)
  windowStart.setUTCHours(0, 0, 0, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchStage: Record<string, any> = {
    userId: session.user.id,
    isArchived: { $ne: true },
    type: { $in: ['income', 'expense'] },
    date: { $gte: windowStart },
  }

  if (upToParam) {
    // Use the exact timestamp provided- the caller already handles boundary precision
    matchStage.date.$lte = new Date(upToParam)
  }

  const col = db.collection<ITransaction>('transactions')
  const [result] = await col
    .aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          income: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
          },
          expenses: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          income: 1,
          expenses: 1,
          balance: { $subtract: ['$income', '$expenses'] },
        },
      },
    ])
    .toArray()

  return NextResponse.json({
    balance: result?.balance ?? 0,
    income: result?.income ?? 0,
    expenses: result?.expenses ?? 0,
    historyDays,
    restricted: !userIsPremium,
  })
}
