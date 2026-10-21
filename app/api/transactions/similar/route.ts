import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { ITransaction } from '@/lib/models/Transaction'
import { parseDateInput } from '@/lib/transactionInput'
import { endOfUtcDay, startOfUtcDay } from '@/lib/services/balanceAdjustment'

/**
 * GET /api/transactions/similar?type=&amount=&date=yyyy-MM-dd
 *     [&accountId=|unassigned] [&fromAccountId=&toAccountId=] [&excludeId=]
 *
 * Entries that look like the one being typed: same type, same amount, same account
 * (or the same two accounts, for a transfer), within a day either side. The forms show
 * a soft "already logged?" warning - saving twice is a common way to drift from the bank.
 * Read-only; never blocks a save.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_MATCHES = 3
const TYPES: ITransaction['type'][] = ['income', 'expense', 'savings', 'transfer']

const idParam = (value: string | null) => (value && ObjectId.isValid(value) ? new ObjectId(value) : null)

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as ITransaction['type']
  const amount = Number(searchParams.get('amount'))
  const date = parseDateInput(searchParams.get('date'))
  if (!TYPES.includes(type) || !Number.isFinite(amount) || amount <= 0 || !date) {
    return NextResponse.json({ error: 'type, amount and date are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {
    userId: session.user.id,
    type,
    isArchived: { $ne: true },
    // Stored amounts are rounded to centavos like typed ones; allow for float noise
    amount: { $gte: amount - 0.005, $lte: amount + 0.005 },
    date: { $gte: new Date(startOfUtcDay(date).getTime() - DAY_MS), $lte: new Date(endOfUtcDay(date).getTime() + DAY_MS) },
  }

  if (type === 'transfer') {
    const from = idParam(searchParams.get('fromAccountId'))
    const to = idParam(searchParams.get('toAccountId'))
    if (!from || !to) return NextResponse.json({ matches: [] })
    query.fromAccountId = from
    query.toAccountId = to
  } else {
    const raw = searchParams.get('accountId')
    if (raw === 'unassigned' || raw === '') query.accountId = null
    else {
      const accountId = idParam(raw)
      if (!accountId) return NextResponse.json({ matches: [] })
      query.accountId = accountId
    }
  }

  const excludeId = idParam(searchParams.get('excludeId'))
  if (excludeId) query._id = { $ne: excludeId }

  const found = await getDb().then((db) =>
    db.collection<ITransaction>('transactions')
      .find(query, { projection: { date: 1, amount: 1, description: 1, category: 1 } })
      .sort({ date: -1 })
      .limit(MAX_MATCHES)
      .toArray()
  )

  return NextResponse.json({
    matches: found.map((t) => ({
      _id: t._id.toString(),
      date: t.date,
      amount: t.amount,
      description: t.description ?? '',
      category: t.category,
    })),
  })
}
