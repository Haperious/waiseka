import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_BUDGET_LIMIT, PREMIUM_BUDGET_LIMIT } from '@/lib/constants'
import { ObjectId } from 'mongodb'
import type { IBudget } from '@/lib/models/Budget'
import type { IUser } from '@/lib/models/User'
import { isCurrencyCode, primaryCurrencyOf } from '@/lib/services/currencyScope'

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const budgets = await db
    .collection<IBudget>('budgets')
    .find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .toArray()

  if (budgets.length === 0) return NextResponse.json([])

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = parseInt(searchParams.get('month') ?? String(now.getUTCMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(now.getUTCFullYear()))

  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay())
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)

  // Each budget only counts expenses in its own currency (a budget or transaction with
  // no currency is in the primary). Spent is grouped by (currency, category) in one pass
  // per period, with missing currencies folded into the primary - the same rule as currencyScope.
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) as never }, { projection: { preferences: 1 } })
  const primary = primaryCurrencyOf(user)

  const spentBy = (start: Date, end: Date) =>
    db.collection('transactions').aggregate<{ _id: { category: string; currency: string }; total: number }>([
      { $match: { userId: session.user.id, type: 'expense', date: { $gte: start, $lte: end } } },
      { $group: { _id: { category: '$category', currency: { $ifNull: ['$currency', primary] } }, total: { $sum: '$amount' } } },
    ]).toArray()

  const [monthlySpent, weeklySpent] = await Promise.all([spentBy(monthStart, monthEnd), spentBy(weekStart, weekEnd)])

  const key = (currency: string, category: string) => `${currency}|${category}`
  const monthlyMap = new Map(monthlySpent.map((r) => [key(r._id.currency, r._id.category), r.total]))
  const weeklyMap = new Map(weeklySpent.map((r) => [key(r._id.currency, r._id.category), r.total]))

  const budgetsWithSpent = budgets.map((b) => {
    const currency = b.currency ?? primary
    const k = key(currency, b.category)
    return {
      ...b,
      currency,
      spent: (b.period === 'weekly' ? weeklyMap.get(k) : monthlyMap.get(k)) ?? 0,
    }
  })

  return NextResponse.json(budgetsWithSpent)
}

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { category, limit, period, color, currency } = body

  if (!category || !limit) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (currency !== undefined && !isCurrencyCode(currency)) {
    return NextResponse.json({ error: 'currency must be PHP, QAR, or USD' }, { status: 400 })
  }

  const now = new Date()
  const db = await getDb()

  // -- Tier gate (PRD D6: budgets in every currency share one limit): free users capped at FREE_BUDGET_LIMIT, premium at PREMIUM_BUDGET_LIMIT
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) as never })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const userIsPremium = isPremium(user)
  const budgetLimit = userIsPremium ? PREMIUM_BUDGET_LIMIT : FREE_BUDGET_LIMIT
  const existingCount = await db.collection<IBudget>('budgets').countDocuments({ userId: session.user.id })
  if (existingCount >= budgetLimit) {
    return NextResponse.json(
      {
        error: userIsPremium
          ? `Premium plan is limited to ${budgetLimit} budgets.`
          : `Free plan is limited to ${budgetLimit} budgets. Upgrade to Premium to add more.`,
      },
      { status: 403 }
    )
  }

  const result = await db.collection<IBudget>('budgets').insertOne({
    userId: session.user.id,
    category,
    limit,
    period: period ?? 'monthly',
    currency: currency ?? primaryCurrencyOf(user),
    spent: 0,
    color,
    createdAt: now,
    updatedAt: now,
  } as IBudget)

  const budget = await db.collection<IBudget>('budgets').findOne({ _id: result.insertedId })
  return NextResponse.json(budget, { status: 201 })
}
