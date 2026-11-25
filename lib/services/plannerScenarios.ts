import type { Db } from 'mongodb'
import type { CurrencyCode } from '@/lib/currency'
import type { IAccount } from '@/lib/models/Account'
import type { IPlannerScenario } from '@/lib/models/PlannerScenario'
import { MAX_PLANNER_NAME as MAX_SCENARIO_NAME, PLANNER_MAX_DAYS_AHEAD } from '@/lib/constants'
import { addDays, addMonths, monthEnd, monthLabel, monthsBetween } from '@/lib/planner/days'
import type { PlannerItem, PlannerScenario } from '@/lib/planner/types'

export const PLANNER_COLLECTION = 'plannerScenarios'

/** A scenario as the API returns it (no userId, string id and dates). */
export function toClientScenario(doc: IPlannerScenario): PlannerScenario {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    currency: doc.currency,
    accountIds: doc.accountIds,
    endDate: doc.endDate,
    items: doc.items,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  }
}

/**
 * The user's open accounts in `currency`, as id strings in display order. `totalMoneyOnly`
 * keeps just the ones the dashboard's Total Money counts (in the total, not credit cards) -
 * a new plan's starting set.
 */
export async function accountIdsInCurrency(
  db: Db, userId: string, currency: CurrencyCode, primary: CurrencyCode, opts: { totalMoneyOnly?: boolean } = {},
): Promise<string[]> {
  const accounts = await db
    .collection<IAccount>('accounts')
    .find({ userId, isArchived: { $ne: true } }, { projection: { currency: 1, includeInTotal: 1, type: 1 } })
    .sort({ displayOrder: 1, createdAt: 1 })
    .toArray()
  return accounts
    .filter((a) => (a.currency ?? primary) === currency)
    .filter((a) => !opts.totalMoneyOnly || (a.includeInTotal !== false && a.type !== 'credit'))
    .map((a) => a._id.toString())
}

const clipName = (name: string) => name.slice(0, MAX_SCENARIO_NAME).trim()

/** "Normal month (copy)" */
export function duplicateName(name: string): string {
  const suffix = ' (copy)'
  return clipName(name.slice(0, MAX_SCENARIO_NAME - suffix.length).trim() + suffix)
}

/**
 * The same plan, moved to the next month: dates shift forward by whole months, a month-end
 * end date stays a month-end, and every item is planned again (not done). A plan from a
 * while back jumps straight to this month or later rather than to a month already past.
 */
export function carryForward(
  source: Pick<IPlannerScenario, 'name' | 'endDate' | 'items'>, today: string,
): { name: string; endDate: string; items: PlannerItem[] } {
  const months = Math.max(1, monthsBetween(source.endDate, today))
  const wasMonthEnd = source.endDate === monthEnd(source.endDate)
  let endDate = wasMonthEnd ? monthEnd(addMonths(source.endDate, months)) : addMonths(source.endDate, months)
  const latest = addDays(today, PLANNER_MAX_DAYS_AHEAD)
  if (endDate > latest) endDate = latest

  const items = source.items.map((item) => ({
    ...item,
    date: item.date ? addMonths(item.date, months) : null,
    done: false,
  }))

  // "Normal month (Nov)" -> "Normal month (Dec)"
  const base = source.name.replace(/\s*\([A-Z][a-z]{2}\)$/, '')
  const suffix = ` (${monthLabel(endDate)})`
  return { name: clipName(base.slice(0, MAX_SCENARIO_NAME - suffix.length).trim() + suffix), endDate, items }
}
