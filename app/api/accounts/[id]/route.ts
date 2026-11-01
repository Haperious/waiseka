import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { badRequest, cleanText, isHexColor, readJsonBody, readOptionalText } from '@/lib/request'
import { readAmount, readBalance, readNonNegativeAmount } from '@/lib/money'
import { isPremium } from '@/lib/tier'
import { FREE_ACCOUNT_LIMIT } from '@/lib/constants'
import type { IUser } from '@/lib/models/User'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import { ACCOUNT_TYPES, type IAccount } from '@/lib/models/Account'
import { INVALID_CURRENCY_MESSAGE, isCurrencyCode } from '@/lib/services/currencyScope'
import { readOpeningBalanceDate } from '@/lib/services/balanceAdjustment'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  // Whitelist editable fields - never allow userId, _id, or system fields to be overwritten
  const update: Partial<IAccount> & { updatedAt: Date } = { updatedAt: new Date() }

  if (body.name !== undefined) {
    const name = cleanText(body.name, 100)
    if (!name) return badRequest('name must be 1-100 characters')
    update.name = name
  }
  if (body.institution !== undefined) {
    const institution = readOptionalText(body.institution, 100)
    if (institution === null) return badRequest('institution must be up to 100 characters')
    update.institution = institution
  }
  if (body.type !== undefined) {
    if (!ACCOUNT_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `type must be one of: ${ACCOUNT_TYPES.join(', ')}` }, { status: 400 })
    }
    update.type = body.type
  }
  if (body.openingBalance !== undefined) {
    const opening = readBalance(body.openingBalance)
    if (opening === null) return badRequest('openingBalance must be a number up to 1,000,000,000,000')
    update.openingBalance = opening
  }
  if (body.openingBalanceDate !== undefined) {
    // null = count every entry (how accounts made before this field behave)
    const checked = readOpeningBalanceDate(body.openingBalanceDate)
    if ('error' in checked) return badRequest(checked.error)
    update.openingBalanceDate = checked.date
  }
  if (body.currency !== undefined) {
    if (!isCurrencyCode(body.currency)) {
      return NextResponse.json({ error: INVALID_CURRENCY_MESSAGE }, { status: 400 })
    }
    update.currency = body.currency
  }
  if (body.creditLimit !== undefined) {
    const limit = body.creditLimit === null ? null : readAmount(body.creditLimit)
    if (body.creditLimit !== null && limit === null) {
      return NextResponse.json({ error: 'creditLimit must be a positive number or null' }, { status: 400 })
    }
    update.creditLimit = limit
  }
  if (body.dueDay !== undefined) {
    if (body.dueDay !== null && (!Number.isInteger(body.dueDay) || body.dueDay < 1 || body.dueDay > 31)) {
      return NextResponse.json({ error: 'dueDay must be an integer between 1 and 31, or null' }, { status: 400 })
    }
    update.dueDay = body.dueDay
  }
  if (body.statementDay !== undefined) {
    if (body.statementDay !== null && (!Number.isInteger(body.statementDay) || body.statementDay < 1 || body.statementDay > 31)) {
      return NextResponse.json({ error: 'statementDay must be an integer between 1 and 31, or null' }, { status: 400 })
    }
    update.statementDay = body.statementDay
  }
  if (body.lowBalanceThreshold !== undefined) {
    const threshold = body.lowBalanceThreshold === null ? null : readNonNegativeAmount(body.lowBalanceThreshold)
    if (body.lowBalanceThreshold !== null && threshold === null) {
      return NextResponse.json({ error: 'lowBalanceThreshold must be a non-negative number or null' }, { status: 400 })
    }
    update.lowBalanceThreshold = threshold
  }
  if (body.color !== undefined) {
    if (body.color !== null && !isHexColor(body.color)) return badRequest('color must be a hex colour like #3b82f6')
    update.color = body.color
  }
  if (body.icon !== undefined) {
    const icon = readOptionalText(body.icon, 50)
    if (icon === null) return badRequest('icon must be up to 50 characters')
    update.icon = icon || null
  }
  if (body.displayOrder !== undefined) {
    if (!Number.isSafeInteger(body.displayOrder)) return badRequest('displayOrder must be a whole number')
    update.displayOrder = body.displayOrder
  }
  if (body.isArchived !== undefined) update.isArchived = !!body.isArchived
  if (body.includeInTotal !== undefined) update.includeInTotal = !!body.includeInTotal

  const db = await getDb()
  const accounts = db.collection<IAccount>('accounts')
  const current = await accounts.findOne(
    { _id, userId: session.user.id },
    { projection: { currency: 1, type: 1, isArchived: 1 } }
  )
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const linkedToHistory = () => db.collection('transactions').countDocuments({
    userId: session.user.id,
    $or: [{ accountId: _id }, { fromAccountId: _id }, { toAccountId: _id }],
  }, { limit: 1 }).then((n) => n > 0)

  // Bringing an account back counts against the free plan's limit, like adding one
  if (update.isArchived === false && current.isArchived) {
    const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!isPremium(user)) {
      const open = await accounts.countDocuments({ userId: session.user.id, isArchived: { $ne: true } })
      if (open >= FREE_ACCOUNT_LIMIT) {
        return NextResponse.json(
          { error: `Free plan is limited to ${FREE_ACCOUNT_LIMIT} accounts. Archive another one or upgrade to Premium.` },
          { status: 403 }
        )
      }
    }
  }

  // A card's figure is what you owe; every other account's is what you have. Switching
  // between them would turn a 5,000 balance into 5,000 owed, so it's locked once used.
  if (update.type !== undefined && (update.type === 'credit') !== (current.type === 'credit') && await linkedToHistory()) {
    return NextResponse.json(
      { error: "This account already has transactions, so it can't switch between a credit card and a regular account. Create a new account instead." },
      { status: 409 }
    )
  }

  // An account's currency is locked once any transaction references it (PRD D4) -
  // changing it would silently re-denominate history. Same-currency writes are no-ops.
  if (update.currency !== undefined) {
    if (current.currency !== update.currency) {
      if (await linkedToHistory()) {
        return NextResponse.json(
          { error: "This account already has transactions, so its currency can't be changed. Create a new account in the other currency instead." },
          { status: 409 }
        )
      }
    }
  }

  const account = await accounts.findOneAndUpdate(
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
  // Transfers reference accounts through fromAccountId/toAccountId, not accountId
  const transactionCount = await db.collection('transactions').countDocuments({
    userId: session.user.id,
    $or: [{ accountId: _id }, { fromAccountId: _id }, { toAccountId: _id }],
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
  // Planned transfers to or from it can never happen now (they store the ids as text)
  const id = _id.toHexString()
  await db.collection('plannedTransfers').deleteMany({
    userId: session.user.id,
    $or: [{ fromAccountId: id }, { toAccountId: id }],
  })
  return NextResponse.json({ message: 'Deleted successfully' })
}
