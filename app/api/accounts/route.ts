import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_ACCOUNT_LIMIT } from '@/lib/constants'
import { ACCOUNT_TYPES, type IAccount } from '@/lib/models/Account'
import type { IUser } from '@/lib/models/User'
import { getAccountActivityMap, computeAssetBalance, computeOutstanding } from '@/lib/services/accountBalance'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const accounts = await db
    .collection<IAccount>('accounts')
    .find({ userId: session.user.id })
    .sort({ isArchived: 1, displayOrder: 1, createdAt: 1 })
    .toArray()

  const activityMap = await getAccountActivityMap(db, session.user.id)

  // Balances are computed here, never stored - same "derived over stored"
  // pattern used for Budget.spent. Nothing below persists to the accounts collection.
  const accountsWithBalance = accounts.map((account) => {
    const activity = activityMap.get(account._id.toString())
    if (account.type === 'credit') {
      const outstandingBalance = computeOutstanding(activity)
      return {
        ...account,
        outstandingBalance,
        availableCredit: account.creditLimit != null ? account.creditLimit - outstandingBalance : null,
      }
    }
    return {
      ...account,
      computedBalance: computeAssetBalance(account.openingBalance, activity),
    }
  })

  return NextResponse.json(accountsWithBalance)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, institution, type, openingBalance, currency, creditLimit, dueDay, lowBalanceThreshold, color, icon, includeInTotal } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!ACCOUNT_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${ACCOUNT_TYPES.join(', ')}` }, { status: 400 })
  }
  if (openingBalance !== undefined && (typeof openingBalance !== 'number' || !isFinite(openingBalance))) {
    return NextResponse.json({ error: 'openingBalance must be a number' }, { status: 400 })
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

  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) as never })
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
    name,
    institution: institution ?? undefined,
    type,
    openingBalance: openingBalance ?? 0,
    currency: currency ?? user.preferences?.currency ?? 'PHP',
    creditLimit: type === 'credit' ? (creditLimit ?? null) : null,
    dueDay: type === 'credit' ? (dueDay ?? null) : null,
    // Low-balance alerts only make sense for asset accounts; credit uses utilization instead.
    lowBalanceThreshold: type === 'credit' ? null : (lowBalanceThreshold ?? null),
    color: color ?? null,
    icon: icon ?? null,
    displayOrder: 0,
    isArchived: false,
    includeInTotal: includeInTotal ?? true,
    createdAt: now,
    updatedAt: now,
  } as IAccount)

  const account = await db.collection<IAccount>('accounts').findOne({ _id: result.insertedId })
  return NextResponse.json(account, { status: 201 })
}
