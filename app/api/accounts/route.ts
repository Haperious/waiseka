import { NextRequest, NextResponse } from 'next/server'
import { badRequest, cleanText, isHexColor, isOptionalText, readJsonBody } from '@/lib/request'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_ACCOUNT_LIMIT } from '@/lib/constants'
import { ACCOUNT_TYPES, type IAccount } from '@/lib/models/Account'
import type { IUser } from '@/lib/models/User'
import { INVALID_CURRENCY_MESSAGE, isCurrencyCode, primaryCurrencyOf } from '@/lib/services/currencyScope'
import { getAccountLedger, computeAssetBalance, computeOutstanding } from '@/lib/services/accountBalance'
import { verificationProbes, verificationStatus, verifiedDaysAgo } from '@/lib/services/verification'
import { readOpeningBalanceDate } from '@/lib/services/balanceAdjustment'

export async function GET() {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const accounts = await db
    .collection<IAccount>('accounts')
    .find({ userId: session.user.id })
    .sort({ isArchived: 1, displayOrder: 1, createdAt: 1 })
    .toArray()

  const { activity: activityMap, probeFigures } = await getAccountLedger(db, session.user.id, {
    probes: verificationProbes(accounts),
  })

  // Balances are computed here, never stored - same "derived over stored"
  // pattern used for Budget.spent. Nothing below persists to the accounts collection.
  const now = new Date()
  const accountsWithBalance = accounts.map((account) => {
    const id = account._id.toString()
    const activity = activityMap.get(id)
    const status = verificationStatus(account, probeFigures.get(id), now)
    if (account.type === 'credit') {
      const outstandingBalance = computeOutstanding(account.openingBalance ?? 0, activity)
      return {
        ...account,
        outstandingBalance,
        availableCredit: account.creditLimit != null ? account.creditLimit - outstandingBalance : null,
        verificationStatus: status,
        verifiedDaysAgo: verifiedDaysAgo(account, now),
      }
    }
    return {
      ...account,
      computedBalance: computeAssetBalance(account.openingBalance, activity),
      verificationStatus: status,
      verifiedDaysAgo: verifiedDaysAgo(account, now),
    }
  })

  return NextResponse.json(accountsWithBalance)
}

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { name, institution, type, openingBalance, currency, creditLimit, dueDay, lowBalanceThreshold, color, icon, includeInTotal } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const accountName = cleanText(name, 100)
  if (!accountName) return badRequest('name must be 1-100 characters')
  if (!isOptionalText(institution, 100)) return badRequest('institution must be up to 100 characters')
  if (color != null && !isHexColor(color)) return badRequest('color must be a hex colour like #3b82f6')
  if (!isOptionalText(icon, 50)) return badRequest('icon must be up to 50 characters')
  if (!ACCOUNT_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${ACCOUNT_TYPES.join(', ')}` }, { status: 400 })
  }
  if (currency !== undefined && currency !== null && !isCurrencyCode(currency)) {
    return NextResponse.json({ error: INVALID_CURRENCY_MESSAGE }, { status: 400 })
  }
  if (openingBalance !== undefined && (typeof openingBalance !== 'number' || !isFinite(openingBalance))) {
    return NextResponse.json({ error: 'openingBalance must be a number' }, { status: 400 })
  }
  // The day the opening balance is true on. Defaults to today: what the bank shows now
  // already includes everything before, so older entries mustn't count twice.
  let openingBalanceDate = new Date()
  if (body.openingBalanceDate !== undefined && body.openingBalanceDate !== null) {
    const checked = readOpeningBalanceDate(body.openingBalanceDate)
    if ('error' in checked) return badRequest(checked.error)
    if (checked.date) openingBalanceDate = checked.date
  }
  if (lowBalanceThreshold !== undefined && lowBalanceThreshold !== null) {
    if (typeof lowBalanceThreshold !== 'number' || !isFinite(lowBalanceThreshold) || lowBalanceThreshold < 0) {
      return NextResponse.json({ error: 'lowBalanceThreshold must be a non-negative number or null' }, { status: 400 })
    }
  }
  if (type === 'credit' && creditLimit !== undefined && creditLimit !== null) {
    if (typeof creditLimit !== 'number' || !isFinite(creditLimit) || creditLimit <= 0) {
      return NextResponse.json({ error: 'creditLimit must be a positive number' }, { status: 400 })
    }
  }
  if (type === 'credit' && dueDay !== undefined && dueDay !== null) {
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      return NextResponse.json({ error: 'dueDay must be an integer between 1 and 31' }, { status: 400 })
    }
  }

  const db = await getDb()

  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // -- Tier gate: free users capped at FREE_ACCOUNT_LIMIT non-archived accounts
  if (!isPremium(user)) {
    const existingCount = await db.collection<IAccount>('accounts').countDocuments({
      userId: session.user.id,
      isArchived: { $ne: true },
    })
    if (existingCount >= FREE_ACCOUNT_LIMIT) {
      return NextResponse.json(
        { error: `Free plan is limited to ${FREE_ACCOUNT_LIMIT} accounts. Upgrade to Premium to add more.` },
        { status: 403 }
      )
    }
  }

  const now = new Date()
  const result = await db.collection<IAccount>('accounts').insertOne({
    userId: session.user.id,
    name: accountName,
    institution: institution || undefined,
    type,
    openingBalance: openingBalance ?? 0,
    openingBalanceDate,
    // Adding the account counts as a check: the opening balance is what the bank showed
    lastVerifiedAt: now,
    lastVerifiedBalance: null,
    lastVerifiedDate: null,
    currency: currency ?? primaryCurrencyOf(user),
    creditLimit: type === 'credit' ? (creditLimit ?? null) : null,
    dueDay: type === 'credit' ? (dueDay ?? null) : null,
    // Low-balance alerts only make sense for asset accounts; credit uses utilization instead.
    lowBalanceThreshold: type === 'credit' ? null : (lowBalanceThreshold ?? null),
    color: color ?? null,
    icon: icon ?? null,
    displayOrder: 0,
    isArchived: false,
    includeInTotal: includeInTotal !== false,
    createdAt: now,
    updatedAt: now,
  } as IAccount)

  const account = await db.collection<IAccount>('accounts').findOne({ _id: result.insertedId })
  return NextResponse.json(account, { status: 201 })
}
