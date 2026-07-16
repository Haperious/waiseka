import { Db } from 'mongodb'
import type { ITransaction } from '@/lib/models/Transaction'

interface AccountActivity {
  income: number
  expense: number
  savings: number
  /** Total transferred INTO this account (destination leg of transfers). */
  transferIn: number
  /** Total transferred OUT of this account (source leg of transfers). */
  transferOut: number
}

function emptyActivity(): AccountActivity {
  return { income: 0, expense: 0, savings: 0, transferIn: 0, transferOut: 0 }
}

/**
 * Aggregates per-account activity for a user. Two aggregations folded into one map:
 *  - income/expense/savings, keyed by accountId
 *  - transfers, split into an outflow leg (fromAccountId) and inflow leg (toAccountId)
 *
 * Mirrors the "derived over stored" pattern already used for Budget.spent -
 * balances are never written to the account document, only computed on read.
 */
export async function getAccountActivityMap(db: Db, userId: string): Promise<Map<string, AccountActivity>> {
  const col = db.collection<ITransaction>('transactions')

  const [directRows, transferRows] = await Promise.all([
    col.aggregate([
      {
        $match: {
          userId,
          isArchived: { $ne: true },
          type: { $in: ['income', 'expense', 'savings'] },
          accountId: { $ne: null },
        },
      },
      {
        $group: {
          _id: { accountId: '$accountId', type: '$type' },
          total: { $sum: '$amount' },
        },
      },
    ]).toArray(),
    col.aggregate([
      {
        $match: {
          userId,
          isArchived: { $ne: true },
          type: 'transfer',
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
 *   balance = openingBalance + income - expense - savings + transferIn - transferOut
 *
 * Credit accounts:
 *   outstanding = expense - income - savings - transferIn + transferOut
 *     - a transfer INTO a card is a payment, so it reduces what you owe
 *     - a transfer OUT of a card (e.g. cash advance) increases what you owe
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
}

export function computeOutstanding(activity: AccountActivity | undefined): number {
  if (!activity) return 0
  return activity.expense
    - activity.income
    - activity.savings
    - activity.transferIn
    + activity.transferOut
}
