import type { Db } from 'mongodb'
import type { ITransaction } from '@/lib/models/Transaction'

/** How far back "most used" looks, so the ranking follows current habits rather than all-time totals. */
export const CATEGORY_USAGE_WINDOW_DAYS = 90

/** Transaction count per category name over the usage window (archived transactions excluded). */
export async function getCategoryUsage(db: Db, userId: string, now = new Date()): Promise<Map<string, number>> {
  const since = new Date(now.getTime() - CATEGORY_USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const rows = await db
    .collection<ITransaction>('transactions')
    .aggregate<{ _id: string; count: number }>([
      { $match: { userId, isArchived: { $ne: true }, date: { $gte: since } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ])
    .toArray()
  return new Map(rows.map((r) => [r._id, r.count]))
}
