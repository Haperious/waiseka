import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IAccount } from '@/lib/models/Account'
import type { IUser } from '@/lib/models/User'
import { currencyScope, primaryCurrencyOf, resolveTransactionCurrency } from '@/lib/services/currencyScope'

/**
 * POST /api/transactions/link { accountId }
 *
 * Links every unassigned income/expense/savings entry to one account, so they start
 * moving its balance. Only entries in the account's currency are linked - linking a
 * ₱ entry to a $ account would silently re-denominate it. The rest stay unassigned and
 * are reported back as `skipped` so the user can link them to another account.
 */
export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { accountId } = body
  if (typeof accountId !== 'string' || !ObjectId.isValid(accountId)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
  }

  const userId = session.user.id
  const db = await getDb()
  const account = await db.collection<IAccount>('accounts').findOne({ _id: new ObjectId(accountId), userId })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (account.isArchived) {
    return NextResponse.json({ error: 'Cannot link transactions to an archived account' }, { status: 409 })
  }

  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { preferences: 1 } }
  )
  const primary = primaryCurrencyOf(user)
  const currency = resolveTransactionCurrency(account, primary)

  // Same set the "Unassigned" filter shows (transfers have no accountId by design)
  const unassigned = {
    userId,
    accountId: null,
    isArchived: { $ne: true },
    type: { $in: ['income', 'expense', 'savings'] as ITransaction['type'][] },
  }
  const col = db.collection<ITransaction>('transactions')
  const result = await col.updateMany(
    { ...unassigned, $and: [currencyScope(currency, primary)] },
    // Old rows without a currency count as the primary one; stamp it now that they have an account
    { $set: { accountId: account._id, currency, updatedAt: new Date() } }
  )
  const skipped = await col.countDocuments(unassigned)

  return NextResponse.json({ linked: result.modifiedCount, skipped })
}
