import { Db, ObjectId } from 'mongodb'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IAccount } from '@/lib/models/Account'

export interface AccountActivity {
  income: number
  expense: number
  savings: number
  /** Total transferred INTO this account (destination leg of transfers). */
  transferIn: number
  /** Total transferred OUT of this account (source leg of transfers). */
  transferOut: number
  /**
   * Sum of balance adjustments (signed). Added straight onto the balance for asset
   * accounts and onto the outstanding amount for credit accounts. Optional so older
   * callers that build activity by hand keep working (missing = 0).
   */
  adjustment?: number
}

function emptyActivity(): AccountActivity {
  return { income: 0, expense: 0, savings: 0, transferIn: 0, transferOut: 0, adjustment: 0 }
}

export interface ActivityOptions {
  /** Only count transactions dated on or before this moment (balance "as of" a date). */
  asOf?: Date
  /** Leave this transaction out (used when re-working an adjustment being edited). */
  excludeTransactionId?: ObjectId
}

/** UTC calendar day as yyyy-MM-dd - the same day Mongo's $dateToString gives by default. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

type ActivityKind = 'income' | 'expense' | 'savings' | 'transferIn' | 'transferOut'

/** One aggregated row: everything of one kind on one account on one day. */
export interface DayActivityRow {
  accountId: string
  day: string
  kind: ActivityKind
  total: number
}

/** A balance adjustment, read as a checkpoint: "the bank showed adjustmentTarget at the end of date". */
export interface CheckpointRow {
  _id: { toString(): string }
  accountId: { toString(): string }
  date: Date
  adjustmentTarget?: number | null
  /** Only used for old rows saved without a target. */
  adjustmentDelta?: number | null
}

export type LedgerAccount = Pick<IAccount, 'type' | 'openingBalance' | 'openingBalanceDate'> & { _id: { toString(): string } }

export interface AccountLedger {
  /** Per-account totals. `adjustment` holds the live sum of every checkpoint's difference. */
  activity: Map<string, AccountActivity>
  /** Each adjustment's live difference, keyed by its transaction id. */
  adjustmentDeltas: Map<string, number>
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** How one kind of activity moves the account's figure (balance, or amount owed for cards). */
function figureSign(isCredit: boolean, kind: ActivityKind): number {
  if (isCredit) return kind === 'expense' || kind === 'transferOut' ? 1 : -1
  return kind === 'income' || kind === 'transferIn' ? 1 : -1
}

/**
 * Pure part of the ledger, kept apart so it can be tested without a database.
 *
 * Two rules keep WaiseKa's balance tied to the bank's:
 *
 * 1. Opening date. The opening balance is what the bank showed on openingBalanceDate, so
 *    anything dated before that day is already inside it and is skipped. Accounts without
 *    the field (made before it existed) skip nothing.
 *
 * 2. Checkpoints. An adjustment means "the bank showed X at the end of this day". Its
 *    difference is worked out here on every read from the history before it, instead of
 *    being frozen when it was saved. So adding, editing or deleting an older entry later
 *    can't knock the balance off again - the checkpoint absorbs it. Checkpoints dated
 *    before the opening date are ignored (difference 0).
 */
export function buildLedger(
  accounts: LedgerAccount[],
  rows: DayActivityRow[],
  checkpoints: CheckpointRow[],
): AccountLedger {
  const accountById = new Map(accounts.map((a) => [a._id.toString(), a]))
  const floorOf = (id: string) => {
    const d = accountById.get(id)?.openingBalanceDate
    return d ? utcDay(new Date(d)) : null
  }

  const activity = new Map<string, AccountActivity>()
  // Net change to the figure per account per day, for walking up to each checkpoint
  const dailyNet = new Map<string, Map<string, number>>()

  for (const row of rows) {
    const floor = floorOf(row.accountId)
    if (floor && row.day < floor) continue
    const entry = activity.get(row.accountId) ?? emptyActivity()
    entry[row.kind] += row.total
    activity.set(row.accountId, entry)

    const account = accountById.get(row.accountId)
    if (!account) continue
    const days = dailyNet.get(row.accountId) ?? new Map<string, number>()
    days.set(row.day, (days.get(row.day) ?? 0) + figureSign(account.type === 'credit', row.kind) * row.total)
    dailyNet.set(row.accountId, days)
  }

  // Checkpoints grouped per account, keeping their (date, createdAt) order
  const byAccount = new Map<string, CheckpointRow[]>()
  for (const cp of checkpoints) {
    const key = cp.accountId.toString()
    const list = byAccount.get(key) ?? []
    list.push(cp)
    byAccount.set(key, list)
  }

  const adjustmentDeltas = new Map<string, number>()
  for (const [accountId, list] of byAccount) {
    const account = accountById.get(accountId)
    const floor = floorOf(accountId)
    const days = [...(dailyNet.get(accountId) ?? new Map<string, number>())].sort(([a], [b]) => (a < b ? -1 : 1))
    let running = account?.openingBalance ?? 0
    let next = 0
    let sum = 0

    for (const cp of list) {
      const day = utcDay(new Date(cp.date))
      if (floor && day < floor) {
        adjustmentDeltas.set(cp._id.toString(), 0)
        continue
      }
      while (next < days.length && days[next][0] <= day) running += days[next++][1]

      let delta: number
      if (account && cp.adjustmentTarget != null) {
        delta = round2(cp.adjustmentTarget - running)
        running = cp.adjustmentTarget
      } else {
        // Unknown account or an old row without a target: keep its saved difference
        delta = cp.adjustmentDelta ?? 0
        running += delta
      }
      sum += delta
      adjustmentDeltas.set(cp._id.toString(), delta)
    }

    const entry = activity.get(accountId) ?? emptyActivity()
    entry.adjustment = round2(sum)
    activity.set(accountId, entry)
  }

  return { activity, adjustmentDeltas }
}

/**
 * Loads a user's accounts, per-day activity and adjustments, then builds the ledger.
 * Balances are never written to the account document, only computed on read - the same
 * "derived over stored" pattern used for Budget.spent.
 */
export async function getAccountLedger(
  db: Db,
  userId: string,
  options: ActivityOptions = {},
): Promise<AccountLedger> {
  const col = db.collection<ITransaction>('transactions')
  const extra: Record<string, unknown> = {}
  if (options.asOf) extra.date = { $lte: options.asOf }
  if (options.excludeTransactionId) extra._id = { $ne: options.excludeTransactionId }
  const day = { $dateToString: { format: '%Y-%m-%d', date: '$date' } }

  const [accounts, directRows, transferRows, checkpoints] = await Promise.all([
    db.collection<IAccount>('accounts')
      .find({ userId }, { projection: { type: 1, openingBalance: 1, openingBalanceDate: 1 } })
      .toArray(),
    col.aggregate([
      {
        $match: {
          userId,
          isArchived: { $ne: true },
          type: { $in: ['income', 'expense', 'savings'] },
          accountId: { $ne: null },
          ...extra,
        },
      },
      { $group: { _id: { accountId: '$accountId', type: '$type', day }, total: { $sum: '$amount' } } },
    ]).toArray(),
    col.aggregate([
      {
        $match: {
          userId,
          isArchived: { $ne: true },
          type: 'transfer',
          ...extra,
        },
      },
      {
        $facet: {
          out: [
            { $match: { fromAccountId: { $ne: null } } },
            { $group: { _id: { accountId: '$fromAccountId', day }, total: { $sum: '$amount' } } },
          ],
          in: [
            { $match: { toAccountId: { $ne: null } } },
            { $group: { _id: { accountId: '$toAccountId', day }, total: { $sum: '$amount' } } },
          ],
        },
      },
    ]).toArray(),
    col
      .find(
        { userId, isArchived: { $ne: true }, type: 'adjustment', accountId: { $ne: null }, ...extra },
        { projection: { accountId: 1, date: 1, adjustmentTarget: 1, adjustmentDelta: 1 } },
      )
      .sort({ date: 1, createdAt: 1 })
      .toArray(),
  ])

  type GroupRow = { _id: { accountId: { toString(): string }; type?: string; day: string }; total: number }
  const rows: DayActivityRow[] = []
  for (const r of directRows as unknown as GroupRow[]) {
    rows.push({ accountId: r._id.accountId.toString(), day: r._id.day, kind: r._id.type as ActivityKind, total: r.total })
  }
  const facet = (transferRows[0] ?? { out: [], in: [] }) as unknown as { out?: GroupRow[]; in?: GroupRow[] }
  for (const r of facet.out ?? []) {
    rows.push({ accountId: r._id.accountId.toString(), day: r._id.day, kind: 'transferOut', total: r.total })
  }
  for (const r of facet.in ?? []) {
    rows.push({ accountId: r._id.accountId.toString(), day: r._id.day, kind: 'transferIn', total: r.total })
  }

  return buildLedger(accounts as unknown as LedgerAccount[], rows, checkpoints as unknown as CheckpointRow[])
}

/** Per-account activity for the balance formulas below. */
export async function getAccountActivityMap(
  db: Db,
  userId: string,
  options: ActivityOptions = {},
): Promise<Map<string, AccountActivity>> {
  return (await getAccountLedger(db, userId, options)).activity
}

/**
 * Sign convention (confirmed against the Goals/Savings implementation - a
 * "savings" transaction is a standalone outflow, not linked to any goal or
 * destination account):
 *
 * Asset accounts (debit, savings, time_deposit, cash, e_wallet):
 *   balance = openingBalance + income - expense - savings + transferIn - transferOut + adjustment
 *
 * Credit accounts:
 *   outstanding = openingBalance + expense - income - savings - transferIn + transferOut + adjustment
 *     - openingBalance is the balance owed when the card was added to WaiseKa
 *     - a transfer INTO a card is a payment, so it reduces what you owe
 *     - a transfer OUT of a card (e.g. cash advance) increases what you owe
 *     - an adjustment's delta is already in "amount owed" terms, so it's added as-is
 *   availableCredit = creditLimit - outstanding (null if no creditLimit set)
 */
export function computeAssetBalance(openingBalance: number, activity: AccountActivity | undefined): number {
  if (!activity) return openingBalance
  return openingBalance
    + activity.income
    - activity.expense
    - activity.savings
    + activity.transferIn
    - activity.transferOut
    + (activity.adjustment ?? 0)
}

export function computeOutstanding(openingBalance: number, activity: AccountActivity | undefined): number {
  if (!activity) return openingBalance
  return openingBalance
    + activity.expense
    - activity.income
    - activity.savings
    - activity.transferIn
    + activity.transferOut
    + (activity.adjustment ?? 0)
}

export function computeAvailableCredit(creditLimit: number | null | undefined, outstanding: number): number | null {
  return creditLimit != null ? creditLimit - outstanding : null
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

/**
 * Next occurrence of a credit account's `dueDay` on or after `today` (UTC calendar
 * day). `dueDay` is clamped to the actual month length, same convention as the
 * cutoff-period resolver. Returns null when the account has no `dueDay` set.
 */
export function nextDueDate(account: { dueDay?: number | null }, today: Date): Date | null {
  if (account.dueDay == null) return null

  const year = today.getUTCFullYear()
  const monthIndex0 = today.getUTCMonth()
  const day = today.getUTCDate()

  const thisMonthDue = Math.min(account.dueDay, daysInMonth(year, monthIndex0))
  if (thisMonthDue >= day) {
    return new Date(Date.UTC(year, monthIndex0, thisMonthDue))
  }

  const nextMonthIndex0 = monthIndex0 + 1
  const nextMonthDue = Math.min(account.dueDay, daysInMonth(year, nextMonthIndex0))
  return new Date(Date.UTC(year, nextMonthIndex0, nextMonthDue))
}
