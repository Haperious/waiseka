import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { IBudget } from '@/lib/models/Budget'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const budgets = await db
    .collection<IBudget>('budgets')
    .find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .toArray()

  if (budgets.length === 0) return NextResponse.json([])

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay())
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)

  // Aggregate spent amounts per category for each period
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
