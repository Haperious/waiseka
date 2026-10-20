import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IAccount } from '@/lib/models/Account'
import type { IUser } from '@/lib/models/User'
import { primaryCurrencyOf, resolveTransactionCurrency } from '@/lib/services/currencyScope'
import { readTransactionFields } from '@/lib/transactionInput'
import { historyWindowStart, isPremium } from '@/lib/tier'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  // Whitelist editable fields - never allow userId, _id, or other system fields to be overwritten
  const update: Partial<ITransaction> & { updatedAt: Date } = { updatedAt: new Date() }
  if (body.amount !== undefined) {
    if (typeof body.amount !== 'number' || !isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
    update.amount = body.amount
  }
  const checked = readTransactionFields(body)
  if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 })
  // tags stay as they are - the edit forms don't send them
  const { tags: _tags, ...fields } = checked.fields
  Object.assign(update, fields)
  if (body.description === null) update.description = ''
  if (body.isRecurring !== undefined) update.isRecurring = Boolean(body.isRecurring)

  const db = await getDb()

  if (update.date) {
    const user = await db.collection<IUser>('users').findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { tier: 1, premiumOverride: 1 } }
    )
    if (update.date < historyWindowStart(user ? isPremium(user) : false)) {
      return NextResponse.json(
        { error: 'That date is outside your history window. Upgrade to Premium for extended history.' },
        { status: 403 }
      )
    }
  }

  if (body.accountId !== undefined) {
    let account: IAccount | null = null
    if (body.accountId === null) {
      update.accountId = null
    } else {
      if (!ObjectId.isValid(body.accountId)) {
        return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
      }
      account = await db.collection<IAccount>('accounts').findOne({
        _id: new ObjectId(body.accountId),
        userId: session.user.id,
      })
      if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      update.accountId = new ObjectId(body.accountId)
    }

    // Moving a transaction to another account moves it to that account's currency.
    // Transfers carry their currency from fromAccountId and are left alone.
    const existing = await db.collection<ITransaction>('transactions').findOne(
      { _id, userId: session.user.id },
      { projection: { type: 1 } }
    )
    if (existing && existing.type !== 'transfer') {
      const user = await db.collection<IUser>('users').findOne(
        { _id: new ObjectId(session.user.id) },
        { projection: { preferences: 1 } }
      )
      update.currency = resolveTransactionCurrency(account, primaryCurrencyOf(user))
    }
  }
  const transaction = await db.collection<ITransaction>('transactions').findOneAndUpdate(
    // Transfers can't become a regular entry here (or the reverse); they're edited by delete + re-create.
    // Adjustments are never edited here - PUT /api/adjustments/[id] re-works their difference.
    update.type
      ? { _id, userId: session.user.id, type: { $nin: ['transfer', 'adjustment'] as ITransaction['type'][] } }
      : { _id, userId: session.user.id, type: { $ne: 'adjustment' as const } },
    { $set: update },
    { returnDocument: 'after' }
  )

  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(transaction)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const db = await getDb()
  const transaction = await db.collection<ITransaction>('transactions').findOneAndDelete({
    _id,
    userId: session.user.id,
  })

  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted successfully' })
}
