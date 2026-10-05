import type { Db } from 'mongodb'
import type { CurrencyCode } from '@/lib/currency'
import type { ITransaction } from '@/lib/models/Transaction'

/** Amount spent in one (currency, category) - 0 when nothing was. */
export type SpentLookup = (currency: CurrencyCode, category: string) => number

/**
 * Expenses over [start, end] grouped by (currency, category), for matching against
 * budgets: a budget only counts spending in its own currency. Transactions with no
 * currency count as the primary - the same rule as currencyScope.
 */
export async function getSpentByCurrencyAndCategory(
  db: Db,
  userId: string,
  primary: CurrencyCode,
  start: Date,
  end: Date,
): Promise<SpentLookup> {
  const rows = await db.collection<ITransaction>('transactions').aggregate<{
    _id: { category: string; currency: CurrencyCode }
    total: number
  }>([
    { $match: { userId, type: 'expense', date: { $gte: start, $lte: end } } },
    { $group: { _id: { category: '$category', currency: { $ifNull: ['$currency', primary] } }, total: { $sum: '$amount' } } },
  ]).toArray()

  const key = (currency: string, category: string) => `${currency}|${category}`
  const spent = new Map(rows.map((r) => [key(r._id.currency, r._id.category), r.total]))
  return (currency, category) => spent.get(key(currency, category)) ?? 0
}
