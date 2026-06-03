import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_BUDGET_LIMIT } from '@/lib/constants'
import { ObjectId } from 'mongodb'
import type { IBudget } from '@/lib/models/Budget'
import type { IUser } from '@/lib/models/User'

export async function GET(req: NextRequest) {
  const session = await auth()
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

  const [monthlySpent, weeklySpent] = await Promise.all([
    db.collection('transactions').aggregate([
      {
        $match: {
          userId: session.user.id,
          type: 'expense',
          date: { $gte: monthStart, $lte: monthEnd },
        },
      },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]).toArray(),
    db.collection('transactions').aggregate([
      {
        $match: {
          userId: session.user.id,
          type: 'expense',
          date: { $gte: weekStart, $lte: weekEnd },
        },
      },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]).toArray(),
  ])

  const monthlyMap = Object.fromEntries(monthlySpent.map((r) => [r._id, r.total]))
  const weeklyMap = Object.fromEntries(weeklySpent.map((r) => [r._id, r.total]))

  const budgetsWithSpent = budgets.map((b) => ({
    ...b,
    spent: b.period === 'weekly' ? (weeklyMap[b.category] ?? 0) : (monthlyMap[b.category] ?? 0),
  }))

  return NextResponse.json(budgetsWithSpent)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { category, limit, period, color } = body

  if (!category || !limit) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const now = new Date()
  const db = await getDb()

  // -- Tier gate: free users capped at FREE_BUDGET_LIMIT active budgets
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) as never })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (!isPremium(user)) {
    const existingCount = await db.collection<IBudget>('budgets').countDocuments({ userId: session.user.id })
    if (existingCount >= FREE_BUDGET_LIMIT) {
      return NextResponse.json(
        { error: `Free plan is limited to ${FREE_BUDGET_LIMIT} budgets. Upgrade to Premium to add more.` },
        { status: 403 }
      )
    }
  }

  const result = await db.collection<IBudget>('budgets').insertOne({
    userId: session.user.id,
    category,
    limit,
    period: period ?? 'monthly',
    spent: 0,
    color,
    createdAt: now,
    updatedAt: now,
  } as IBudget)

  const budget = await db.collection<IBudget>('budgets').findOne({ _id: result.insertedId })
  return NextResponse.json(budget, { status: 201 })
}
