import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import { ACCOUNT_TYPES, type IAccount } from '@/lib/models/Account'
import { INVALID_CURRENCY_MESSAGE, isCurrencyCode } from '@/lib/services/currencyScope'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const body = await req.json()

  // Whitelist editable fields - never allow userId, _id, or system fields to be overwritten
  const update: Partial<IAccount> & { updatedAt: Date } = { updatedAt: new Date() }

  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    update.name = body.name
  }
  if (body.institution !== undefined) update.institution = body.institution
  if (body.type !== undefined) {
    if (!ACCOUNT_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `type must be one of: ${ACCOUNT_TYPES.join(', ')}` }, { status: 400 })
    }
    update.type = body.type
  }
  if (body.openingBalance !== undefined) {
    if (typeof body.openingBalance !== 'number' || !isFinite(body.openingBalance)) {
      return NextResponse.json({ error: 'openingBalance must be a number' }, { status: 400 })
    }
    update.openingBalance = body.openingBalance
  }
  if (body.currency !== undefined) {
    if (!isCurrencyCode(body.currency)) {
      return NextResponse.json({ error: INVALID_CURRENCY_MESSAGE }, { status: 400 })
    }
    update.currency = body.currency
  }
  if (body.creditLimit !== undefined) {
    if (body.creditLimit !== null && (typeof body.creditLimit !== 'number' || !isFinite(body.creditLimit) || body.creditLimit <= 0)) {
      return NextResponse.json({ error: 'creditLimit must be a positive number or null' }, { status: 400 })
    }
    update.creditLimit = body.creditLimit
  }
  if (body.dueDay !== undefined) {
    if (body.dueDay !== null && (!Number.isInteger(body.dueDay) || body.dueDay < 1 || body.dueDay > 31)) {
      return NextResponse.json({ error: 'dueDay must be an integer between 1 and 31, or null' }, { status: 400 })
    }
    update.dueDay = body.dueDay
  }
  if (body.lowBalanceThreshold !== undefined) {
    if (body.lowBalanceThreshold !== null && (typeof body.lowBalanceThreshold !== 'number' || !isFinite(body.lowBalanceThreshold) || body.lowBalanceThreshold < 0)) {
      return NextResponse.json({ error: 'lowBalanceThreshold must be a non-negative number or null' }, { status: 400 })
    }
    update.lowBalanceThreshold = body.lowBalanceThreshold
  }
  if (body.color !== undefined) update.color = body.color
  if (body.icon !== undefined) update.icon = body.icon
  if (body.displayOrder !== undefined) update.displayOrder = body.displayOrder
  if (body.isArchived !== undefined) update.isArchived = !!body.isArchived
  if (body.includeInTotal !== undefined) update.includeInTotal = !!body.includeInTotal

  const db = await getDb()

  // An account's currency is locked once any transaction references it (PRD D4) -
  // changing it would silently re-denominate history. Same-currency writes are no-ops.
  if (update.currency !== undefined) {
    const current = await db.collection<IAccount>('accounts').findOne(
      { _id, userId: session.user.id },
      { projection: { currency: 1 } }
    )
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (current.currency !== update.currency) {
      const linked = await db.collection('transactions').countDocuments({
        userId: session.user.id,
        $or: [
          { accountId: _id },
          { fromAccountId: _id },
          { toAccountId: _id },
        ],
      }, { limit: 1 })
      if (linked > 0) {
        return NextResponse.json(
          { error: "This account already has transactions, so its currency can't be changed. Create a new account in the other currency instead." },
          { status: 409 }
        )
      }
    }
  }

  const account = await db.collection<IAccount>('accounts').findOneAndUpdate(
    { _id, userId: session.user.id },
    { $set: update },
    { returnDocument: 'after' }
  )

  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(account)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const db = await getDb()

  // Never hard-delete an account that has transactions referencing it - it would
  // orphan historical records and break derived balance calculations. Archive instead.
  const transactionCount = await db.collection('transactions').countDocuments({
    userId: session.user.id,
    accountId: _id,
  })
  if (transactionCount > 0) {
    return NextResponse.json(
      { error: 'This account has transactions linked to it. Archive it instead of deleting.' },
      { status: 409 }
    )
  }

  const account = await db.collection<IAccount>('accounts').findOneAndDelete({
    _id,
    userId: session.user.id,
  })

  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted successfully' })
}
