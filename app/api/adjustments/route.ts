import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { historyWindowStart, isPremium } from '@/lib/tier'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IAccount } from '@/lib/models/Account'
import type { IUser } from '@/lib/models/User'
import {
  ADJUSTMENT_CATEGORY, BEFORE_OPENING_DATE_ERROR, accountFigureAsOf, adjustmentDelta, endOfUtcDay,
  isBeforeOpeningDate, readAdjustmentInput, roundMoney, startOfUtcDay,
} from '@/lib/services/balanceAdjustment'

/**
 * Balance adjustments - "my bank says ₱5,000, make WaiseKa match".
 *
 * GET  /api/adjustments?accountId=&date=yyyy-MM-dd[&excludeId=]
 *      The account's balance (amount owed, for a card) at the end of that date, so the
 *      confirm step can show "from X to Y". excludeId leaves out an adjustment being edited.
 *
 * POST /api/adjustments { accountId, targetBalance, date, note? }
 *      Saves a checkpoint as a `type: 'adjustment'` transaction. Like transfers, the type
 *      keeps it out of income, spending, budgets, savings and reports. A second one for the
 *      same account and day replaces the first (200, replaced: true). Edited via
 *      PUT /api/adjustments/[id]; deleted via DELETE /api/transactions/[id].
 */

async function loadAccount(db: Awaited<ReturnType<typeof getDb>>, userId: string, accountId: unknown) {
  if (typeof accountId !== 'string' || !ObjectId.isValid(accountId)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
  }
  // Never trust a client-supplied id - it must be one of the caller's accounts
  const account = await db.collection<IAccount>('accounts').findOne({ _id: new ObjectId(accountId), userId })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  return account
}

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const checked = readAdjustmentInput({ date: searchParams.get('date') ?? undefined }, { requireAll: false })
  if ('error' in checked || !checked.input.date) {
    return NextResponse.json({ error: 'date must be a valid date' }, { status: 400 })
  }
  const excludeRaw = searchParams.get('excludeId')
  if (excludeRaw && !ObjectId.isValid(excludeRaw)) {
    return NextResponse.json({ error: 'Invalid excludeId' }, { status: 400 })
  }

  const db = await getDb()
  const account = await loadAccount(db, session.user.id, searchParams.get('accountId'))
  if (account instanceof NextResponse) return account

  const balance = await accountFigureAsOf(
    db, session.user.id, account, checked.input.date, excludeRaw ? new ObjectId(excludeRaw) : undefined,
  )
  return NextResponse.json({ balance, currency: account.currency })
}

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const checked = readAdjustmentInput(body, { requireAll: true })
  if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 })
  const { targetBalance, date, note } = checked.input as Required<Pick<typeof checked.input, 'targetBalance' | 'date'>> & { note?: string }

  const db = await getDb()
  const account = await loadAccount(db, session.user.id, body.accountId)
  if (account instanceof NextResponse) return account
  if (account.isArchived) {
    return NextResponse.json({ error: 'Cannot adjust an archived account' }, { status: 409 })
  }

  // Same rule as every other entry: nothing older than the plan's history window
  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { tier: 1, premiumOverride: 1 } }
  )
  if (date < historyWindowStart(user ? isPremium(user) : false)) {
    return NextResponse.json(
      { error: 'That date is outside your history window. Upgrade to Premium for extended history.' },
      { status: 403 }
    )
  }

  if (isBeforeOpeningDate(account, date)) {
    return NextResponse.json({ error: BEFORE_OPENING_DATE_ERROR }, { status: 400 })
  }

  const current = await accountFigureAsOf(db, session.user.id, account, date)
  const delta = adjustmentDelta(current, targetBalance)
  if (delta === null) {
    return NextResponse.json({ error: 'The balance already matches - nothing to adjust.' }, { status: 409 })
  }

  const col = db.collection<ITransaction>('transactions')
  const now = new Date()

  // One checkpoint per account per day: the bank shows one balance at the end of a day,
  // so a second adjustment that day replaces the first instead of stacking on it.
  const sameDay = await col.findOne(
    {
      userId: session.user.id,
      type: 'adjustment',
      accountId: account._id,
      isArchived: { $ne: true },
      date: { $gte: startOfUtcDay(date), $lte: endOfUtcDay(date) },
    },
    { sort: { createdAt: -1 } }
  )
  if (sameDay) {
    const before = await accountFigureAsOf(db, session.user.id, account, date, sameDay._id)
    const replacedDelta = roundMoney(targetBalance - before)
    const update: Partial<ITransaction> = {
      amount: Math.abs(replacedDelta),
      adjustmentDelta: replacedDelta,
      adjustmentTarget: targetBalance,
      updatedAt: now,
    }
    if (note !== undefined) update.description = note
    const adjustment = await col.findOneAndUpdate(
      { _id: sameDay._id, userId: session.user.id, type: 'adjustment' },
      { $set: update },
      { returnDocument: 'after' }
    )
    return NextResponse.json({ adjustment, previousBalance: current, replaced: true })
  }

  const doc: Omit<ITransaction, '_id'> = {
    userId: session.user.id,
    amount: Math.abs(delta),
    currency: account.currency,
    type: 'adjustment',
    category: ADJUSTMENT_CATEGORY,
    description: note ?? '',
    date,
    tags: [],
    isRecurring: false,
    accountId: account._id,
    adjustmentDelta: delta,
    adjustmentTarget: targetBalance,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  }
  const result = await db.collection<Omit<ITransaction, '_id'>>('transactions').insertOne(doc)

  return NextResponse.json({ adjustment: { _id: result.insertedId, ...doc }, previousBalance: current }, { status: 201 })
}
