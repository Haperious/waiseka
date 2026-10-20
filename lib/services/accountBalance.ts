import { Db, ObjectId } from 'mongodb'
import type { ITransaction } from '@/lib/models/Transaction'

interface AccountActivity {
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

/**
 * Aggregates per-account activity for a user. Two aggregations folded into one map:
 *  - income/expense/savings, keyed by accountId
 *  - transfers, split into an outflow leg (fromAccountId) and inflow leg (toAccountId)
 *
 * Mirrors the "derived over stored" pattern already used for Budget.spent -
 * balances are never written to the account document, only computed on read.
 */
export async function getAccountActivityMap(
  db: Db,
  userId: string,
  options: ActivityOptions = {},
): Promise<Map<string, AccountActivity>> {
  const col = db.collection<ITransaction>('transactions')
  const extra: Record<string, unknown> = {}
  if (options.asOf) extra.date = { $lte: options.asOf }
  if (options.excludeTransactionId) extra._id = { $ne: options.excludeTransactionId }

  const [directRows, transferRows] = await Promise.all([
    col.aggregate([
      {
        $match: {
          userId,
          isArchived: { $ne: true },
          type: { $in: ['income', 'expense', 'savings', 'adjustment'] },
          accountId: { $ne: null },
          ...extra,
        },
      },
      {
        $group: {
          _id: { accountId: '$accountId', type: '$type' },
          // Adjustments carry their signed change in adjustmentDelta; amount is only its size
          total: { $sum: { $cond: [{ $eq: ['$type', 'adjustment'] }, { $ifNull: ['$adjustmentDelta', 0] }, '$amount'] } },
        },
      },
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
            { $group: { _id: '$fromAccountId', total: { $sum: '$amount' } } },
          ],
          in: [
            { $match: { toAccountId: { $ne: null } } },
            { $group: { _id: '$toAccountId', total: { $sum: '$amount' } } },
          ],
        },
      },
    ]).toArray(),
  ])

  const map = new Map<string, AccountActivity>()

  for (const row of directRows as unknown as { _id: { accountId: { toString(): string }; type: string }; total: number }[]) {
    const key = row._id.accountId.toString()
    const entry = map.get(key) ?? emptyActivity()
    if (row._id.type === 'income') entry.income += row.total
    else if (row._id.type === 'expense') entry.expense += row.total
    else if (row._id.type === 'savings') entry.savings += row.total
    else if (row._id.type === 'adjustment') entry.adjustment = (entry.adjustment ?? 0) + row.total
    map.set(key, entry)
  }

  const facet = (transferRows[0] ?? { out: [], in: [] }) as unknown as {
    out: { _id: { toString(): string }; total: number }[]
    in: { _id: { toString(): string }; total: number }[]
  }
  for (const row of facet.out) {
    const key = row._id.toString()
    const entry = map.get(key) ?? emptyActivity()
    entry.transferOut += row.total
    map.set(key, entry)
  }
  for (const row of facet.in) {
    const key = row._id.toString()
    const entry = map.get(key) ?? emptyActivity()
    entry.transferIn += row.total
    map.set(key, entry)
  }

  return map
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
