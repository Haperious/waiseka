import type { Projection } from './projection'
import type { PlannerItem } from './types'

/** One concrete way out of a dip below zero: move an expense to after the next income. */
export interface FixSuggestion {
  item: PlannerItem
  fromDay: string
  toDay: string
  income: PlannerItem
}

/**
 * The "Move it" fix for the first day the balance goes below zero:
 * 1. No negative day → nothing to fix.
 * 2. The largest counted manual expense landing on that day (ties: earliest in the list).
 *    Budgets, card bills and recurring items are never moved.
 * 3. The first counted income landing after that day (ties: earliest in the list).
 * Returns null when either is missing.
 */
export function findFixSuggestion(items: PlannerItem[], projection: Projection): FixSuggestion | null {
  const negDay = projection.firstNegativeDay
  if (!negDay) return null

  const counted = (i: PlannerItem) => projection.items[i.id]?.status === 'counted'
  const landing = (i: PlannerItem) => projection.items[i.id]?.day ?? null

  let culprit: PlannerItem | null = null
  for (const i of items) {
    if (!counted(i) || i.type !== 'expense' || i.source !== 'manual' || landing(i) !== negDay) continue
    const amount = projection.items[i.id].amount
    if (!culprit || amount > projection.items[culprit.id].amount) culprit = i
  }
  if (!culprit) return null

  let income: PlannerItem | null = null
  let incomeDay: string | null = null
  for (const i of items) {
    const day = landing(i)
    if (!counted(i) || i.type !== 'income' || !day || day <= negDay) continue
    if (!incomeDay || day < incomeDay) {
      income = i
      incomeDay = day
    }
  }
  if (!income || !incomeDay) return null

  return { item: culprit, fromDay: negDay, toDay: incomeDay, income }
}
