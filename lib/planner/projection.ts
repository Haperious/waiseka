import { roundMoney } from '@/lib/money'
import { addDays, daysBetween, monthEnd } from './days'
import type { PlannerContext, PlannerItem, PlannerScenario } from './types'

/*
 * The Planner's day-by-day running balance. Pure, so the page can re-run it on every
 * keystroke and the dashboard card (server side) gets exactly the same numbers.
 *
 *   start   = picked accounts as of the end of today (cards count as money owed)
 *   each day = previous day + planned items on that day + real entries already logged for it
 *
 * Where an item lands:
 * - dated items on their day; ones dated before today are overdue and still count today
 *   (they're expected but haven't happened - dropping them would flatter the forecast)
 * - undated expenses today and undated income on the end date, so the low point is never
 *   rosier than reality
 * - a budget's leftover is spread evenly over the rest of the month
 * - a card bill on its due day, for whatever the card owes right now
 */

export type ItemStatus =
  /** In the math. */
  | 'counted'
  /** Switched off by the user. */
  | 'off'
  | 'done'
  /** Dated after the end date. */
  | 'afterEnd'
  /** Its budget or card was deleted, archived or is in another currency. */
  | 'unavailable'
  /** A card bill for a card that's one of the picked accounts - it's already in the starting balance. */
  | 'coveredByAccounts'
  /** Budget fully spent, or the card owes nothing. */
  | 'nothingLeft'

export interface ResolvedItem {
  id: string
  /** The amount the item stands for (live for budgets and cards), whether or not it counts. */
  amount: number
  /** The day it counts on (first day for a spread budget), or null when it doesn't count. */
  day: string | null
  status: ItemStatus
  /** Planned, not done, dated before today. */
  overdue: boolean
  /** Budgets only: the days the leftover is spread over. */
  spread?: { from: string; to: string }
  /** A real transaction with the same type, category and amount is already logged. */
  possibleMatch: boolean
}

export interface ProjectionEvent {
  kind: 'item' | 'scheduled'
  /** Item id, or transaction id for scheduled entries. */
  id: string
  label: string
  /** Signed: + adds money, - takes it. */
  amount: number
  /** One day's share of a budget spread across the month. */
  spread?: boolean
}

export interface ProjectionDay {
  day: string
  /** Balance at the end of this day. */
  balance: number
  events: ProjectionEvent[]
}

export interface Projection {
  start: number
  end: number
  /** Counted planned income and expenses (expenses as a positive figure). */
  plannedIncome: number
  plannedExpenses: number
  /** Net of real entries already logged for days after today. */
  scheduledNet: number
  lowest: { balance: number; day: string }
  /** First day the balance goes below zero, or null. */
  firstNegativeDay: string | null
  days: ProjectionDay[]
  items: Record<string, ResolvedItem>
  /** The end date is before today - nothing ahead to project. */
  expired: boolean
  overdueCount: number
  matchCount: number
}

type ScenarioInput = Pick<PlannerScenario, 'accountIds' | 'endDate' | 'items'>

/** Starting total of the picked accounts: balances minus what's owed on cards. */
export function startingBalance(scenario: Pick<PlannerScenario, 'accountIds'>, context: PlannerContext): number {
  const picked = new Set(scenario.accountIds)
  let total = 0
  for (const a of context.accounts) {
    if (!picked.has(a.id)) continue
    total += a.type === 'credit' ? -a.figure : a.figure
  }
  return roundMoney(total)
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Real entries matching planned items one-to-one (same type, category and amount). */
function findMatches(items: PlannerItem[], context: PlannerContext, pickedIds: Set<string>): Set<string> {
  const pool = [
    ...context.logged,
    // A future-dated entry already logged on a picked account is in the timeline too
    ...context.scheduled
      .filter((s) => pickedIds.has(s.accountId) && (s.type === 'income' || s.type === 'expense'))
      .map((s) => ({ type: s.type, category: s.category, amount: s.amount, day: s.day })),
  ]
  const used = new Set<number>()
  const matched = new Set<string>()
  for (const item of items) {
    if (item.done || (item.source !== 'manual' && item.source !== 'recurring')) continue
    const i = pool.findIndex((e, idx) =>
      !used.has(idx) && e.type === item.type && sameText(e.category, item.category) && Math.abs(e.amount - item.amount) < 0.005)
    if (i >= 0) {
      used.add(i)
      matched.add(item.id)
    }
  }
  return matched
}

/** Splits `total` over `n` days to the centavo, the last day taking the rounding crumbs. */
function splitEvenly(total: number, n: number): number[] {
  const cents = Math.round(total * 100)
  const per = Math.floor(cents / n)
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? cents - per * (n - 1) : per) / 100)
}

export function itemLabel(item: Pick<PlannerItem, 'category' | 'note'>): string {
  return item.note ? `${item.category} · ${item.note}` : item.category
}

export function projectScenario(scenario: ScenarioInput, context: PlannerContext): Projection {
  const today = context.today
  const expired = scenario.endDate < today
  const end = expired ? today : scenario.endDate
  const length = daysBetween(today, end) + 1
  const dayIndex = (day: string) => daysBetween(today, day)

  const days: ProjectionDay[] = Array.from({ length }, (_, i) => ({ day: addDays(today, i), balance: 0, events: [] }))
  const picked = new Set(scenario.accountIds)
  const budgets = new Map(context.budgets.map((b) => [b.id, b]))
  const cards = new Map(context.cards.map((c) => [c.id, c]))
  const matches = findMatches(scenario.items, context, picked)

  let plannedIncome = 0
  let plannedExpenses = 0
  let overdueCount = 0
  let matchCount = 0
  const items: Record<string, ResolvedItem> = {}

  const add = (index: number, event: ProjectionEvent) => {
    if (index < 0 || index >= length) return
    days[index].events.push(event)
  }

  for (const item of scenario.items) {
    const sign = item.type === 'income' ? 1 : -1
    const resolved: ResolvedItem = { id: item.id, amount: item.amount, day: null, status: 'counted', overdue: false, possibleMatch: false }
    items[item.id] = resolved

    // Live amount and default day per source
    let day: string | null = item.date
    if (item.source === 'budget') {
      const budget = item.sourceRef ? budgets.get(item.sourceRef) : undefined
      if (!budget) { resolved.status = 'unavailable'; resolved.amount = 0; continue }
      resolved.amount = budget.remaining
      day = null
    } else if (item.source === 'card') {
      const card = item.sourceRef ? cards.get(item.sourceRef) : undefined
      if (!card) { resolved.status = 'unavailable'; resolved.amount = 0; continue }
      resolved.amount = Math.max(0, card.outstanding)
      day = card.dueDate
      if (picked.has(card.id)) { resolved.status = 'coveredByAccounts'; continue }
    }

    if (item.done) { resolved.status = 'done'; continue }
    if (!item.enabled) { resolved.status = 'off'; continue }
    if (resolved.amount <= 0) { resolved.status = 'nothingLeft'; continue }
    if (expired) { resolved.status = 'afterEnd'; continue }

    if (matches.has(item.id)) { resolved.possibleMatch = true; matchCount++ }

    if (item.source === 'budget') {
      // Spread over what's left of this month, inside the plan
      const to = monthEnd(today) < end ? monthEnd(today) : end
      const n = daysBetween(today, to) + 1
      const shares = splitEvenly(resolved.amount, n)
      shares.forEach((share, i) => add(i, { kind: 'item', id: item.id, label: itemLabel(item), amount: -share, spread: true }))
      resolved.day = today
      resolved.spread = { from: today, to }
      plannedExpenses += resolved.amount
      continue
    }

    if (day && day > end) { resolved.status = 'afterEnd'; continue }
    if (day && day < today && item.source !== 'card') {
      resolved.overdue = true
      overdueCount++
    }
    const countOn = !day || day < today ? (item.type === 'income' && !day ? end : today) : day
    resolved.day = countOn
    add(dayIndex(countOn), { kind: 'item', id: item.id, label: itemLabel(item), amount: sign * resolved.amount })
    if (sign > 0) plannedIncome += resolved.amount
    else plannedExpenses += resolved.amount
  }

  // Real entries already logged for days after today, on picked accounts
  let scheduledNet = 0
  if (!expired) {
    for (const s of context.scheduled) {
      if (!picked.has(s.accountId) || s.day <= today || s.day > end) continue
      scheduledNet += s.delta
      add(dayIndex(s.day), { kind: 'scheduled', id: s.id, label: s.description || s.category, amount: s.delta })
    }
  }

  const start = startingBalance(scenario, context)
  let running = start
  let lowest = { balance: Infinity, day: today }
  let firstNegativeDay: string | null = null
  for (const d of days) {
    for (const e of d.events) running += e.amount
    d.balance = roundMoney(running)
    if (d.balance < lowest.balance) lowest = { balance: d.balance, day: d.day }
    if (firstNegativeDay === null && d.balance < 0) firstNegativeDay = d.day
  }

  return {
    start,
    end: days[days.length - 1].balance,
    plannedIncome: roundMoney(plannedIncome),
    plannedExpenses: roundMoney(plannedExpenses),
    scheduledNet: roundMoney(scheduledNet),
    lowest,
    firstNegativeDay,
    days,
    items,
    expired,
    overdueCount,
    matchCount,
  }
}
