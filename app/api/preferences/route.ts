import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { CURRENCY_SYMBOL_MAP } from '@/lib/models/User'
import type { IUser } from '@/lib/models/User'
import { MAX_HIDDEN_ACCOUNTS } from '@/lib/constants'

const VALID_CURRENCIES = ['PHP', 'QAR', 'USD']

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { preferences: 1 } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(user.preferences)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { currency, theme, defaultAccountId, transactionsHiddenAccountIds, transactionsAccountStripCollapsed } = body

  const update: Record<string, unknown> = { updatedAt: new Date() }

  if (currency !== undefined) {
    if (!VALID_CURRENCIES.includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency code' }, { status: 400 })
    }
    update['preferences.currency'] = currency
    update['preferences.currencySymbol'] = CURRENCY_SYMBOL_MAP[currency] ?? '$'
  }

  if (theme !== undefined) {
    if (theme !== 'light' && theme !== 'dark') {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }
    update['preferences.theme'] = theme
  }

  if (transactionsHiddenAccountIds !== undefined) {
    if (
      !Array.isArray(transactionsHiddenAccountIds) ||
      transactionsHiddenAccountIds.some((id) => typeof id !== 'string' || !ObjectId.isValid(id))
    ) {
      return NextResponse.json({ error: 'Invalid transactionsHiddenAccountIds' }, { status: 400 })
    }
    if (transactionsHiddenAccountIds.length > MAX_HIDDEN_ACCOUNTS) {
      return NextResponse.json(
        { error: `Cannot hide more than ${MAX_HIDDEN_ACCOUNTS} accounts` },
        { status: 400 }
      )
    }
    update['preferences.transactionsHiddenAccountIds'] = transactionsHiddenAccountIds
  }

  if (transactionsAccountStripCollapsed !== undefined) {
    if (typeof transactionsAccountStripCollapsed !== 'boolean') {
      return NextResponse.json({ error: 'Invalid transactionsAccountStripCollapsed' }, { status: 400 })
    }
    update['preferences.transactionsAccountStripCollapsed'] = transactionsAccountStripCollapsed
  }

  const db = await getDb()

  if (defaultAccountId !== undefined) {
    if (defaultAccountId === null) {
      update['preferences.defaultAccountId'] = null
    } else {
      if (!ObjectId.isValid(defaultAccountId)) {
        return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
      }
      const account = await db.collection('accounts').findOne({
        _id: new ObjectId(defaultAccountId),
        userId: session.user.id,
      })
      if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      update['preferences.defaultAccountId'] = defaultAccountId
    }
  }

  const user = await db.collection<IUser>('users').findOneAndUpdate(
    { _id: new ObjectId(session.user.id) },
    { $set: update },
    { returnDocument: 'after', projection: { preferences: 1 } }
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(user.preferences)
}
