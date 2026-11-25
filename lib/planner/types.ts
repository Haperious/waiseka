import type { CurrencyCode } from '@/lib/currency'

/*
 * Planner: "what if" income and expenses that never become transactions. Shared by the
 * API, the Planner page and the dashboard card. Dates are yyyy-MM-dd calendar days, the
 * same days the rest of the app stores at UTC noon.
 */

export type PlannerItemType = 'income' | 'expense'

/**
 * Where an item came from:
 * - manual: typed in by the user
 * - recurring: suggested from a transaction marked recurring (amount copied once)
 * - budget: what's left of a monthly budget - its amount is worked out live, so it shrinks as you spend
 * - card: a credit card bill - its amount is the card's live amount owed, due on its due day
 */
export type PlannerItemSource = 'manual' | 'recurring' | 'budget' | 'card'

export const PLANNER_ITEM_SOURCES: readonly PlannerItemSource[] = ['manual', 'recurring', 'budget', 'card']

export interface PlannerItem {
  /** Made by the client; unique within the scenario. */
  id: string
  type: PlannerItemType
  /** Fixed amount for manual and recurring items. Ignored (0) for budget and card items. */
  amount: number
  category: string
  note?: string
  /** yyyy-MM-dd, or null for "sometime before the end date". */
  date: string | null
  /** Off = kept in the list but left out of the math ("what if I skip this?"). */
  enabled: boolean
  /** It happened (or was logged as a real transaction), so it no longer counts. */
  done: boolean
  source: PlannerItemSource
  /** Budget id for budget items, card account id for card items, the recurring key for recurring ones. */
  sourceRef?: string
}

export interface PlannerScenario {
  _id: string
  name: string
  /** Fixed when the scenario is made: only accounts, budgets and cards in it count. */
  currency: CurrencyCode
  /** Accounts whose balances make up the starting balance. Credit cards count as money owed. */
  accountIds: string[]
  /** yyyy-MM-dd */
  endDate: string
  items: PlannerItem[]
  createdAt: string
  updatedAt: string
}

/** One account the scenario can start from, with its figure as of the end of `today`. */
export interface PlannerAccount {
  id: string
  name: string
  type: 'debit' | 'credit' | 'savings' | 'time_deposit' | 'cash' | 'e_wallet'
  /** Balance for asset accounts; amount owed for credit cards. */
  figure: number
  includeInTotal: boolean
}

/** A real transaction already logged with a date after today, on one account. */
export interface PlannerScheduledEntry {
  /** Transaction id; a transfer between two accounts shows up once per account. */
  id: string
  accountId: string
  day: string
  /** Change to the starting total if this account is picked (+ adds money, - takes it). */
  delta: number
  type: 'income' | 'expense' | 'savings' | 'transfer'
  category: string
  description?: string
  amount: number
}

export interface PlannerBudget {
  id: string
  category: string
  limit: number
  spent: number
  /** limit - spent, never below 0. */
  remaining: number
}

export interface PlannerCard {
  id: string
  name: string
  /** Amount owed right now. */
  outstanding: number
  /** Next due day on or after today, or null when the card has no due day set. */
  dueDate: string | null
}

/** A recurring transaction that hasn't been logged yet this month. */
export interface PlannerSuggestion {
  /** Stable key, stored as the item's sourceRef so it isn't suggested twice. */
  key: string
  type: PlannerItemType
  amount: number
  category: string
  note?: string
  date: string
}

/** A real entry logged this month, used to spot planned items that already happened. */
export interface PlannerLoggedEntry {
  type: string
  category: string
  amount: number
  day: string
}

/** Live figures the projection needs, worked out on the server for one scenario's currency. */
export interface PlannerContext {
  /** The day the projection starts (the viewer's today). */
  today: string
  accounts: PlannerAccount[]
  scheduled: PlannerScheduledEntry[]
  budgets: PlannerBudget[]
  cards: PlannerCard[]
  suggestions: PlannerSuggestion[]
  logged: PlannerLoggedEntry[]
}

export interface PlannerScenarioListItem {
  _id: string
  name: string
  currency: CurrencyCode
  endDate: string
  itemCount: number
  updatedAt: string
}

export interface PlannerListResponse {
  scenarios: PlannerScenarioListItem[]
  /** Null = no limit shown (premium). */
  limit: number | null
}

/** The dashboard card's view of the most recently changed plan (GET /api/planner/summary). */
export interface PlannerSummary {
  id: string
  name: string
  currency: CurrencyCode
  endDate: string
  start: number
  end: number
  lowest: { balance: number; day: string }
  firstNegativeDay: string | null
  overdueCount: number
  expired: boolean
}
