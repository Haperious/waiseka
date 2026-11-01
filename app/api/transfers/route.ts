import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody, readOptionalText } from '@/lib/request'
import { readAmount } from '@/lib/money'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IAccount } from '@/lib/models/Account'
import type { IUser } from '@/lib/models/User'
import { MAX_DESCRIPTION_LENGTH, MAX_ENTRY_DAYS_AHEAD, isTooFarAhead, parseDateInput } from '@/lib/transactionInput'
import { historyWindowStart, isPremium } from '@/lib/tier'
import { getAccountActivityMap, computeOutstanding } from '@/lib/services/accountBalance'
import { isBeforeOpeningDate } from '@/lib/services/balanceAdjustment'

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
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { fromAccountId, toAccountId, date } = body

  if (!fromAccountId || !toAccountId) {
    return NextResponse.json({ error: 'Both fromAccountId and toAccountId are required' }, { status: 400 })
  }
  if (typeof fromAccountId !== 'string' || typeof toAccountId !== 'string'
    || !ObjectId.isValid(fromAccountId) || !ObjectId.isValid(toAccountId)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
  }
  const fromId = new ObjectId(fromAccountId)
  const toId = new ObjectId(toAccountId)
  if (fromId.equals(toId)) {
    return NextResponse.json({ error: 'Cannot transfer to the same account' }, { status: 400 })
  }
  const amount = readAmount(body.amount)
  if (amount === null) {
    return NextResponse.json({ error: 'amount must be a positive number up to 1,000,000,000,000' }, { status: 400 })
  }
  // An unreadable date used to be saved as Invalid Date, which drops out of every balance
  let transferDate = new Date()
  if (date !== undefined && date !== null && date !== '') {
    const parsed = parseDateInput(date)
    if (!parsed) return NextResponse.json({ error: 'date must be a valid date' }, { status: 400 })
    if (isTooFarAhead(parsed, MAX_ENTRY_DAYS_AHEAD)) {
      return NextResponse.json({ error: 'date can be at most a year ahead' }, { status: 400 })
    }
    transferDate = parsed
  }
  const description = readOptionalText(body.description, MAX_DESCRIPTION_LENGTH)
  if (description === null) {
    return NextResponse.json({ error: `description must be text up to ${MAX_DESCRIPTION_LENGTH} characters` }, { status: 400 })
  }

  const db = await getDb()

  // Same rule as every other entry: nothing older than the plan's history window
  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { tier: 1, premiumOverride: 1 } }
  )
  if (transferDate < historyWindowStart(user ? isPremium(user) : false)) {
    return NextResponse.json(
      { error: 'That date is outside your history window. Upgrade to Premium for extended history.' },
      { status: 403 }
    )
  }

  // Both accounts must belong to the caller - never trust client-supplied ids
  const accounts = await db.collection<IAccount>('accounts').find({
    _id: { $in: [fromId, toId] },
    userId: session.user.id,
  }).toArray()

  const fromAccount = accounts.find((a) => a._id.equals(fromId))
  const toAccount = accounts.find((a) => a._id.equals(toId))
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
    const currentOutstanding = computeOutstanding(toAccount.openingBalance ?? 0, activityMap.get(toAccount._id.toString()))
    if (amount > currentOutstanding) overpayment = true
  }

  // A transfer dated before one account's opening date only counts on the other side,
  // so the two balances disagree with the bank. Saved anyway, but flagged for the UI.
  const beforeOpening = [fromAccount, toAccount]
    .filter((a) => isBeforeOpeningDate(a, transferDate))
    .map((a) => a.name)

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
    description: description || `${fromAccount.name} → ${toAccount.name}`,
    date: transferDate,
    tags: [],
    isRecurring: false,
    accountId: null,
    fromAccountId: fromId,
    toAccountId: toId,
    countsAsSavings,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  })

  const transfer = await db.collection<ITransaction>('transactions').findOne({ _id: result.insertedId })
  return NextResponse.json({ transfer, overpayment, beforeOpening }, { status: 201 })
}
