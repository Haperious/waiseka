import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_HISTORY_DAYS, PREMIUM_HISTORY_DAYS } from '@/lib/constants'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IBudget } from '@/lib/models/Budget'
import type { IUser } from '@/lib/models/User'
import { sendSpendingAlertEmail } from '@/lib/email'
import { formatCurrency } from '@/lib/utils'
import type { IEmailLog } from '@/lib/models/EmailLog'

interface BulkTransactionItem {
  amount: number
  type: 'income' | 'expense' | 'savings'
  category: string
  description?: string
  date: string
  isRecurring?: boolean
  currency?: string
}

interface ValidationError {
  index: number
  fields: Record<string, string>
}

function validateItem(item: BulkTransactionItem, index: number): ValidationError | null {
  const fields: Record<string, string> = {}

  if (!item.type) fields.type = 'Type is required'
  if (!item.category) fields.category = 'Category is required'
  if (!item.date) fields.date = 'Date is required'
  if (typeof item.amount !== 'number' || !isFinite(item.amount) || item.amount <= 0) {
    fields.amount = 'Amount must be a positive number'
  }

  if (Object.keys(fields).length > 0) return { index, fields }
  return null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { transactions } = body as { transactions: BulkTransactionItem[] }

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: 'transactions must be a non-empty array' }, { status: 400 })
  }

  if (transactions.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 transactions per batch' }, { status: 400 })
  }

  // Validate all rows before touching the DB
  const validationErrors: ValidationError[] = []
  for (let i = 0; i < transactions.length; i++) {
    const err = validateItem(transactions[i], i)
    if (err) validationErrors.push(err)
  }

  if (validationErrors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', validationErrors }, { status: 422 })
  }

  const db = await getDb()

  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(session.user.id) as never },
    { projection: { name: 1, email: 1, preferences: 1 } }
  )

  const userIsPremium = user ? isPremium(user as IUser & { _id: unknown }) : false
  const historyDays = userIsPremium ? PREMIUM_HISTORY_DAYS : FREE_HISTORY_DAYS
  const retentionWindowStart = new Date()
  retentionWindowStart.setDate(retentionWindowStart.getDate() - historyDays)
  retentionWindowStart.setHours(0, 0, 0, 0)

  const ALLOWED_CURRENCIES: ITransaction['currency'][] = ['PHP', 'QAR', 'USD']
  const rawCurrency = transactions[0].currency ?? user?.preferences?.currency ?? 'PHP'
  const resolvedCurrency: ITransaction['currency'] = ALLOWED_CURRENCIES.includes(rawCurrency as ITransaction['currency'])
    ? (rawCurrency as ITransaction['currency'])
    : 'PHP'

  const now = new Date()

  const docs = transactions.map((t) => {
    const txCurrency = ALLOWED_CURRENCIES.includes(t.currency as ITransaction['currency'])
      ? (t.currency as ITransaction['currency'])
      : resolvedCurrency
    return {
      userId: session.user.id,
      amount: t.amount,
      currency: txCurrency,
      type: t.type,
      category: t.category,
      description: t.description ?? '',
      date: new Date(t.date),
      tags: [] as string[],
      isRecurring: t.isRecurring ?? false,
      isArchived: false as const,
      createdAt: now,
      updatedAt: now,
    }
  })

  // Check that none of the dates fall outside the user's retention window
  const outOfWindow = docs.filter((d) => d.date < retentionWindowStart)
  if (outOfWindow.length > 0) {
    return NextResponse.json(
      { error: `${outOfWindow.length} transaction(s) fall outside your history window. Upgrade to Premium for extended history.` },
      { status: 403 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await db.collection<ITransaction>('transactions').insertMany(docs as any)

  // Fire spending alerts for all expense transactions (non-blocking)
  if (user) {
    const expenseItems = transactions.filter((t) => t.type === 'expense')
    for (const t of expenseItems) {
      checkSpendingAlert(
        session.user.id,
        t.category,
        t.description ?? t.category,
        t.amount,
        db,
        user as Pick<IUser, 'name' | 'email' | 'preferences'>,
        resolvedCurrency,
      ).catch((err) => console.error('[transactions/bulk] spending alert error:', err))
    }
  }

  return NextResponse.json(
    { inserted: result.insertedCount },
    { status: 201 }
  )
}

async function checkSpendingAlert(
  userId: string,
  category: string,
  merchantName: string,
  triggerAmount: number,
  db: Awaited<ReturnType<typeof getDb>>,
  user: Pick<IUser, 'name' | 'email' | 'preferences'>,
  resolvedCurrency: string,
) {
  const budget = await db.collection<IBudget>('budgets').findOne({ userId, category })
  if (!budget) return

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  const [spentAgg, recentTxns, allBudgetSpent] = await Promise.all([
    db.collection<ITransaction>('transactions').aggregate([
      { $match: { userId, category, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray(),
    db.collection<ITransaction>('transactions')
      .find({ userId, category, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } })
      .sort({ date: -1 }).limit(3).toArray(),
    db.collection<ITransaction>('transactions').aggregate([
      { $match: { userId, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]).toArray(),
  ])

  const totalSpent = spentAgg[0]?.total ?? 0
  if (totalSpent <= budget.limit) return

  const previousTotal = totalSpent - triggerAmount
  if (previousTotal >= budget.limit) return

  // Dedup: only one spending alert per category per calendar month
  const logMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const alreadyAlerted = await db.collection<IEmailLog>('email_logs').findOne({
    userId,
    type: 'spending_alert',
    category,
    sentAt: { $gte: monthStart, $lt: logMonthEnd },
  })
  if (alreadyAlerted) return

  const sym = user.preferences?.currencySymbol ?? '₱'
  const fmt = (n: number) => formatCurrency(n, sym)

  const allBudgets = await db.collection<IBudget>('budgets').find({ userId }).toArray()
  const spentMap = Object.fromEntries(
    allBudgetSpent.map((r) => [
      (r as { _id: string; total: number })._id,
      (r as { _id: string; total: number }).total,
    ])
  )
  const surplus = allBudgets
    .filter((b: IBudget) => b.category !== category && (spentMap[b.category] ?? 0) < b.limit)
    .sort(
      (a: IBudget, b: IBudget) =>
        b.limit - (spentMap[b.category] ?? 0) - (a.limit - (spentMap[a.category] ?? 0))
    )[0]

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
      date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      label: t.amount === triggerAmount ? "exceeded limit" : "",
      amount: fmt(t.amount),
    })),
    surplusCategory: surplus?.category ?? "Other",
    surplusCategoryRemaining: surplus ? fmt(surplus.limit - (spentMap[surplus.category] ?? 0)) : fmt(0),
  })

  // Log the send so we can dedup future alerts this month
  await db.collection<Omit<IEmailLog, '_id'>>('email_logs').insertOne({
    userId,
    type: 'spending_alert',
    category,
    sentAt: now,
  } as unknown as Omit<IEmailLog, '_id'>)

  void resolvedCurrency // suppress unused warning
}
