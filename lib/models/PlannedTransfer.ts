import { ObjectId } from 'mongodb'

/**
 * An expected recurring transfer per cutoff period (e.g. "move ₱5,000 to savings
 * every payday"). Powers the "Needs you today" pending-transfer insight - there is
 * no template/schedule collection elsewhere in the codebase to piggyback on, so this
 * is intentionally small and single-purpose rather than a general recurring-transaction
 * system.
 */
export interface IPlannedTransfer {
  _id: ObjectId
  userId: string
  amount: number
  fromAccountId: string
  toAccountId: string
  /** Day-of-month this transfer is expected, clamped like Account.dueDay (1-31, "30"+ means end of month). */
  cutoffDay: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}
