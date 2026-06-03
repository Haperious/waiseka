import { NextRequest, NextResponse } from 'next/server'
import { Db, ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_HISTORY_DAYS } from '@/lib/constants'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IBudget } from '@/lib/models/Budget'
import type { IUser } from '@/lib/models/User'
import { sendSpendingAlertEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const category = searchParams.get('category')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const tags = searchParams.get('tags')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')

  const db = await getDb()

  // -- Tier gate: clamp history to rolling FREE_HISTORY_DAYS for free users
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) as never })
  const userIsPremium = user ? isPremium(user) : false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { userId: session.user.id }
  if (type) query.type = type
  if (category) query.category = category

  if (!userIsPremium) {
    const freeWindowStart = new Date()
    freeWindowStart.setDate(freeWindowStart.getDate() - FREE_HISTORY_DAYS)
    freeWindowStart.setHours(0, 0, 0, 0)

    const callerStart = startDate ? new Date(startDate) : null
    const effectiveStart = callerStart && callerStart > freeWindowStart ? callerStart : freeWindowStart

    query.date = { $gte: effectiveStart }
    if (endDate) query.date.$lte = new Date(endDate)
  } else {
    if (startDate || endDate) {
      query.date = {}
      if (startDate) query.date.$gte = new Date(startDate)
      if (endDate) query.date.$lte = new Date(endDate)
    }
  }

  if (tags) query.tags = { $in: tags.split(',') }
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.description = { $regex: escapedSearch, $options: 'i' }
  }

  const col = db.collection<ITransaction>('transactions')
  const [total, transactions] = await Promise.all([
    col.countDocuments(query),
    col.find(query).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
  ])

  return NextResponse.json({ transactions, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { amount, type, category, description, date, tags, isRecurring } = body

  if (!type || !category || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  const now = new Date()
  const db = await getDb()
  const result = await db.collection<ITransaction>('transactions').insertOne({
    userId: session.user.id,
    amount,
    type,
    category,
    description,
    date: new Date(date),
    tags: tags ?? [],
    isRecurring: isRecurring ?? false,
    createdAt: now,
    updatedAt: now,
  } as ITransaction)

  const transaction = await db.collection<ITransaction>('transactions').findOne({ _id: result.insertedId })

  if (type === 'expense') {
    checkSpendingAlert(session.user.id, category, description ?? category, amount, db).catch(
      (err) => console.error('[transactions] spending alert error:', err)
    )
  }

  return NextResponse.json(transaction, { status: 201 })
}

async function checkSpendingAlert(userId: string, category: string, merchantName: string, triggerAmount: number, db: Db) {
  const budget = await db.collection<IBudget>('budgets').findOne({ userId, category })
  if (!budget) return

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  const [spentAgg, recentTxns, user, allBudgetSpent] = await Promise.all([
    db.collection<ITransaction>('transactions').aggregate([
      { $match: { userId, category, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray(),
    db.collection<ITransaction>('transactions')
      .find({ userId, category, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } })
      .sort({ date: -1 }).limit(3).toArray(),
    db.collection<IUser>('users').findOne({ _id: userId } as never, { projection: { name: 1, email: 1, preferences: 1 } }),
    db.collection<ITransaction>('transactions').aggregate([
      { $match: { userId, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]).toArray(),
  ])

  const totalSpent = spentAgg[0]?.total ?? 0
  if (totalSpent <= budget.limit) return

  const previousTotal = totalSpent - triggerAmount
  if (previousTotal >= budget.limit) return

  if (!user) return

  const sym = user.preferences?.currencySymbol ?? '₱'
  const fmt = (n: number) => `${sym}${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

  const allBudgets = await db.collection<IBudget>('budgets').find({ userId }).toArray()
  const spentMap = Object.fromEntries(allBudgetSpent.map((r) => [(r as { _id: string; total: number })._id, (r as { _id: string; total: number }).total]))
  const surplus = allBudgets
    .filter((b: IBudget) => b.category !== category && (spentMap[b.category] ?? 0) < b.limit)
    .sort((a: IBudget, b: IBudget) => (b.limit - (spentMap[b.category] ?? 0)) - (a.limit - (spentMap[a.category] ?? 0)))[0]

  const daysRemaining = monthEnd.getUTCDate() - now.getUTCDate()
  const monthName = now.toLocaleString('en-US', { month: 'long' })

  await sendSpendingAlertEmail({
    firstName: user.name.split(' ')[0],
    email: user.email,
    categoryName: category,
    budgetLimit: fmt(budget.limit),
    totalSpent: fmt(totalSpent),
    overBy: fmt(totalSpent - budget.limit),
    triggerAmount: fmt(triggerAmount),
    triggerMerchant: merchantName,
    monthName,
    daysRemaining,
    recentTxns: recentTxns.map((t: ITransaction) => ({
      merchantName: t.description || t.category,
      date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      label: t.amount === triggerAmount ? 'exceeded limit' : '',
      amount: fmt(t.amount),
    })),
    surplusCategory: surplus?.category ?? 'Other',
    surplusCategoryRemaining: surplus ? fmt(surplus.limit - (spentMap[surplus.category] ?? 0)) : fmt(0),
  })
}
