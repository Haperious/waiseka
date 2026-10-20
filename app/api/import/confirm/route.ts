import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { historyWindowStart, isPremium } from '@/lib/tier'
import { NextRequest, NextResponse } from 'next/server'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'
import { ObjectId } from 'mongodb'
import { primaryCurrencyOf } from '@/lib/services/currencyScope'
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

  const db = await getDb()

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
    // Imports have no account (out of scope, PRD Q4), so they take the primary currency
    const currency = primaryCurrencyOf(user)
    await col.insertMany(fresh.map((r) => ({
      ...r,
      userId,
      currency,
      tags: [],
      accountId: null,
      isArchived: false,
      source: 'import',
      createdAt: now,
      updatedAt: now,
    })) as unknown as ITransaction[])
  }

  return NextResponse.json({ inserted: fresh.length, skipped: rows.length - fresh.length, invalid })
}
