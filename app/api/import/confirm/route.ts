import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { historyWindowStart, isPremium } from '@/lib/tier'
import { NextRequest, NextResponse } from 'next/server'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'
import { ObjectId } from 'mongodb'
import type { IAccount } from '@/lib/models/Account'
import { primaryCurrencyOf, resolveTransactionCurrency } from '@/lib/services/currencyScope'
import { isBeforeOpeningDate } from '@/lib/services/balanceAdjustment'
import { importDedupeKey, MAX_IMPORT_ROWS, sanitizeImportRow, type ImportRow } from '@/lib/importRows'

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const body = await req.json().catch(() => null)
  const transactions: unknown = body?.transactions

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0, invalid: 0 })
  }
  if (transactions.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_IMPORT_ROWS} transactions per import` }, { status: 400 })
  }

  // The statement's account. Optional for older clients (rows stay unassigned), but the
  // import screen always sends one so imported spending moves a real balance.
  const rawAccountId: unknown = body?.accountId
  if (rawAccountId != null && (typeof rawAccountId !== 'string' || !ObjectId.isValid(rawAccountId))) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
  }

  const db = await getDb()

  let account: IAccount | null = null
  if (typeof rawAccountId === 'string') {
    // Never trust a client-supplied id - it must be one of the caller's open accounts
    account = await db.collection<IAccount>('accounts').findOne({ _id: new ObjectId(rawAccountId), userId })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    if (account.isArchived) {
      return NextResponse.json({ error: 'Cannot import into an archived account' }, { status: 409 })
    }
  }

  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(userId) })
  const userIsPremium = user ? isPremium({ tier: user.tier, premiumOverride: user.premiumOverride }) : false

  const now = new Date()
  const windowStart = historyWindowStart(userIsPremium, now)
  const rows = transactions
    .map((t) => sanitizeImportRow(t, windowStart, now))
    .filter((r): r is ImportRow => r !== null)
  const invalid = transactions.length - rows.length

  // One lookup for the whole batch instead of one per row
  const col = db.collection<ITransaction>('transactions')
  const existing = rows.length
    ? await col
        .find(
          { userId, date: { $in: rows.map((r) => r.date) } },
          { projection: { date: 1, amount: 1, description: 1 } }
        )
        .toArray()
    : []
  const alreadyImported = new Set(existing.map(importDedupeKey))
  const fresh = rows.filter((r) => !alreadyImported.has(importDedupeKey(r)))

  if (fresh.length > 0) {
    // Same rule as any entry: the account's currency, else the primary one
    const currency = resolveTransactionCurrency(account, primaryCurrencyOf(user))
    await col.insertMany(fresh.map((r) => ({
      ...r,
      userId,
      currency,
      tags: [],
      accountId: account?._id ?? null,
      isArchived: false,
      source: 'import',
      createdAt: now,
      updatedAt: now,
    })) as unknown as ITransaction[])
  }

  // Rows before the account's opening date are already inside its opening balance,
  // so they're saved but don't move it - the screen tells the user how many
  const linked = account
  const beforeOpening = linked ? fresh.filter((r) => isBeforeOpeningDate(linked, r.date)).length : 0

  return NextResponse.json({ inserted: fresh.length, skipped: rows.length - fresh.length, invalid, beforeOpening })
}
