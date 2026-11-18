import { ObjectId } from 'mongodb'
import type { CurrencyCode } from '@/lib/currency'
import type { PlannerItem } from '@/lib/planner/types'

/**
 * A saved Planner scenario: a starting set of accounts plus "what if" income and expenses
 * up to an end date. Kept apart from transactions on purpose - nothing here ever counts in
 * balances, budgets or reports. See lib/planner/projection.ts for the maths.
 */
export interface IPlannerScenario {
  _id: ObjectId
  userId: string
  name: string
  currency: CurrencyCode
  /** Account ids (strings) whose balances make up the starting balance. */
  accountIds: string[]
  /** yyyy-MM-dd */
  endDate: string
  items: PlannerItem[]
  createdAt: Date
  updatedAt: Date
}
