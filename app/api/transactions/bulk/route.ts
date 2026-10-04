import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium, historyWindowStart } from '@/lib/tier'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'
import { parseTransactionDate } from '@/lib/utils'
import { checkSpendingAlert } from '@/lib/notifications'

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
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { transactions, accountId } = body as { transactions: BulkTransactionItem[]; accountId?: string | null }

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: 'transactions must be a non-empty array' }, { status: 400 })
  }
  if (accountId && !ObjectId.isValid(accountId)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
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

  // Verify the shared account belongs to this user before linking it to every row
  if (accountId) {
    const account = await db.collection('accounts').findOne({ _id: new ObjectId(accountId), userId: session.user.id })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(session.user.id) as never },
    { projection: { name: 1, email: 1, preferences: 1, tier: 1, premiumOverride: 1 } }
  )

  const userIsPremium = user ? isPremium(user) : false
  const retentionWindowStart = historyWindowStart(userIsPremium)

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
      date: parseTransactionDate(t.date),
      tags: [] as string[],
      isRecurring: t.isRecurring ?? false,
      accountId: accountId ? new ObjectId(accountId) : null,
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

  // Fire spending alerts (non-blocking), once per category with the batch's combined
  // total - one check per row would race past the per-month dedup and send duplicates.
  if (user) {
    const expenseByCategory = new Map<string, { total: number; merchant: string }>()
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      const entry = expenseByCategory.get(t.category) ?? { total: 0, merchant: t.description || t.category }
      entry.total += t.amount
      expenseByCategory.set(t.category, entry)
    }
    for (const [category, { total, merchant }] of expenseByCategory) {
      checkSpendingAlert(session.user.id, category, merchant, total, db, user)
        .catch((err) => console.error('[transactions/bulk] spending alert error:', err))
    }
  }

  return NextResponse.json(
    { inserted: result.insertedCount },
    { status: 201 }
  )
}
