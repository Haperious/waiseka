import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IAccount } from '@/lib/models/Account'
import { parseTransactionDate } from '@/lib/utils'
import { getAccountActivityMap, computeOutstanding } from '@/lib/services/accountBalance'

/**
 * POST /api/transfers
 *
 * Records a transfer between two of the user's own accounts as a single
 * `type: 'transfer'` transaction (Option A). The one document carries both legs
 * via fromAccountId/toAccountId; balance aggregation reads it as -amount on the
 * source and +amount on the destination. Because the type is neither 'income'
 * nor 'expense', transfers are automatically excluded from every budget, summary,
 * balance, and spending-alert query that filters on those types. The exception is
 * totalSavings/health score: a transfer into a savings/time_deposit account is
 * flagged countsAsSavings and picked up by /api/summary alongside type: 'savings'.
 *
 * A credit card payment is just a transfer whose destination is a credit account.
 * Overpayment (paying more than the current outstanding) is allowed - it produces
 * a negative outstanding (a credit balance owed to the user) - but the response
 * flags it so the UI can warn.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fromAccountId, toAccountId, amount, description, date } = body

  if (!fromAccountId || !toAccountId) {
    return NextResponse.json({ error: 'Both fromAccountId and toAccountId are required' }, { status: 400 })
  }
  if (!ObjectId.isValid(fromAccountId) || !ObjectId.isValid(toAccountId)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
  }
  if (fromAccountId === toAccountId) {
    return NextResponse.json({ error: 'Cannot transfer to the same account' }, { status: 400 })
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  const db = await getDb()

  // Both accounts must belong to the caller - never trust client-supplied ids
  const accounts = await db.collection<IAccount>('accounts').find({
    _id: { $in: [new ObjectId(fromAccountId), new ObjectId(toAccountId)] },
    userId: session.user.id,
  }).toArray()

  const fromAccount = accounts.find((a) => a._id.toString() === fromAccountId)
  const toAccount = accounts.find((a) => a._id.toString() === toAccountId)
  if (!fromAccount || !toAccount) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
  if (fromAccount.isArchived || toAccount.isArchived) {
    return NextResponse.json({ error: 'Cannot transfer to or from an archived account' }, { status: 409 })
  }

  // Cross-currency transfers are rejected for now (Phase 5 decision - revisit later)
  if (fromAccount.currency !== toAccount.currency) {
    return NextResponse.json(
      { error: 'Both accounts must use the same currency. Cross-currency transfers are not supported yet.' },
      { status: 409 }
    )
  }

  // Overpayment detection (only meaningful when paying INTO a credit account).
  // Not blocked - just surfaced so the UI can warn.
  let overpayment = false
  if (toAccount.type === 'credit') {
    const activityMap = await getAccountActivityMap(db, session.user.id)
    const currentOutstanding = computeOutstanding(activityMap.get(toAccount._id.toString()))
    if (amount > currentOutstanding) overpayment = true
  }

  // Money moved into a savings/time_deposit account is savings behavior -
  // count it toward totalSavings/health score alongside type: 'savings' transactions.
  const countsAsSavings = toAccount.type === 'savings' || toAccount.type === 'time_deposit'

  const now = new Date()
  const result = await db.collection<Omit<ITransaction, '_id'>>('transactions').insertOne({
    userId: session.user.id,
    amount,
    currency: fromAccount.currency,
    type: 'transfer',
    category: 'Transfer',
    description: description ?? `${fromAccount.name} → ${toAccount.name}`,
    date: date ? parseTransactionDate(date) : now,
    tags: [],
    isRecurring: false,
    accountId: null,
    fromAccountId: new ObjectId(fromAccountId),
    toAccountId: new ObjectId(toAccountId),
    countsAsSavings,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  })

  const transfer = await db.collection<ITransaction>('transactions').findOne({ _id: result.insertedId })
  return NextResponse.json({ transfer, overpayment }, { status: 201 })
}
