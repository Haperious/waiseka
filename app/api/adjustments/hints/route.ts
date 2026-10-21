import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IAccount } from '@/lib/models/Account'
import type { IUser } from '@/lib/models/User'
import { utcDay } from '@/lib/services/accountBalance'
import {
  accountFigureAsOf, adjustmentDelta, endOfUtcDay, readAdjustmentInput, startOfUtcDay,
} from '@/lib/services/balanceAdjustment'
import { currencyScope, primaryCurrencyOf, resolveTransactionCurrency } from '@/lib/services/currencyScope'
import { buildGapHints, type HintEntry } from '@/lib/services/gapHints'

/**
 * GET /api/adjustments/hints?accountId=&date=yyyy-MM-dd&target=[&excludeId=]
 *
 * Likely causes of the gap between WaiseKa and the bank, shown before an adjustment is
 * saved (see lib/services/gapHints.ts). Looks at the period since the account's last
 * checkpoint - anything older is already absorbed by it - or since the opening date.
 * Read-only.
 */

/** Without a checkpoint or opening date, look this far back. */
const FALLBACK_DAYS = 180
/** Upper bound on entries read per list, so a huge history can't make this slow. */
const MAX_ENTRIES = 2000

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const target = Number(searchParams.get('target'))
  const checked = readAdjustmentInput(
    { date: searchParams.get('date') ?? undefined, targetBalance: searchParams.get('target') === null ? undefined : target },
    { requireAll: true },
  )
  if ('error' in checked) return NextResponse.json({ error: checked.error.replace('targetBalance', 'target') }, { status: 400 })
  const { date, targetBalance } = checked.input as { date: Date; targetBalance: number }

  const accountId = searchParams.get('accountId')
  const excludeRaw = searchParams.get('excludeId')
  if (!accountId || !ObjectId.isValid(accountId) || (excludeRaw && !ObjectId.isValid(excludeRaw))) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const excludeId = excludeRaw ? new ObjectId(excludeRaw) : undefined

  const db = await getDb()
  const account = await db.collection<IAccount>('accounts').findOne({ _id: new ObjectId(accountId), userId })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const current = await accountFigureAsOf(db, userId, account, date, excludeId)
  const delta = adjustmentDelta(current, targetBalance)
  if (delta === null) return NextResponse.json({ delta: 0, since: null, hints: null })

  const col = db.collection<ITransaction>('transactions')
  const dayEnd = endOfUtcDay(date)
  const opening = account.openingBalanceDate ? startOfUtcDay(new Date(account.openingBalanceDate)) : null

  // Window start: the day after the last checkpoint before this date, else the opening date
  const lastCheckpoint = await col.findOne(
    {
      userId,
      type: 'adjustment',
      accountId: account._id,
      isArchived: { $ne: true },
      date: { $lt: startOfUtcDay(date) },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    },
    { sort: { date: -1 } },
  )
  let since = lastCheckpoint
    ? new Date(endOfUtcDay(lastCheckpoint.date).getTime() + 1)
    : opening ?? new Date(startOfUtcDay(date).getTime() - FALLBACK_DAYS * 86400000)
  if (opening && since < opening) since = opening

  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } })
  const primary = primaryCurrencyOf(user)
  const currency = resolveTransactionCurrency(account, primary)
  const notArchived = { isArchived: { $ne: true } }
  const onAccount = { $or: [{ accountId: account._id }, { fromAccountId: account._id }, { toAccountId: account._id }] }

  const [accountDocs, unlinkedDocs, beforeDocs] = await Promise.all([
    col.find({ userId, ...notArchived, ...onAccount, type: { $ne: 'adjustment' }, date: { $gte: since, $lte: dayEnd } })
      .sort({ date: -1 }).limit(MAX_ENTRIES).toArray(),
    col.find({
      userId, ...notArchived, accountId: null, type: { $in: ['income', 'expense', 'savings'] },
      date: { $gte: since, $lte: dayEnd }, $and: [currencyScope(currency, primary)],
    }).sort({ date: -1 }).limit(MAX_ENTRIES).toArray(),
    opening
      ? col.find({ userId, ...notArchived, ...onAccount, type: { $ne: 'adjustment' }, date: { $lt: opening } })
          .limit(MAX_ENTRIES).toArray()
      : Promise.resolve([] as ITransaction[]),
  ])

  const toEntry = (t: ITransaction): HintEntry => ({
    _id: t._id.toString(),
    type: t.type as HintEntry['type'],
    amount: t.amount,
    day: utcDay(new Date(t.date)),
    description: t.description || undefined,
    category: t.category,
    outgoing: t.type === 'transfer' ? t.fromAccountId?.toString() === account._id.toString() : undefined,
  })

  const hints = buildGapHints({
    delta,
    isCredit: account.type === 'credit',
    accountEntries: accountDocs.map(toEntry),
    unlinkedEntries: unlinkedDocs.map(toEntry),
    beforeOpeningEntries: beforeDocs.map(toEntry),
  })

  return NextResponse.json({ delta, since: utcDay(since), hints })
}
