import type { Db, Filter, ObjectId } from 'mongodb'
import type { IBudget } from '@/lib/models/Budget'
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

/**
 * Another budget on the same category, period and currency (budgets saved without a
 * currency are in the primary), or null. `excludeId` leaves out the budget being edited.
 */
export async function findDuplicateBudget(
  db: Db,
  userId: string,
  category: string,
  period: IBudget['period'],
  currency: CurrencyCode,
  primary: CurrencyCode,
  excludeId?: ObjectId,
): Promise<IBudget | null> {
  return db.collection<IBudget>('budgets').findOne({
    userId,
    category,
    period,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: currency === primary ? [{ currency }, { currency: { $exists: false } }, { currency: null }] : [{ currency }],
  } as Filter<IBudget>)
}
