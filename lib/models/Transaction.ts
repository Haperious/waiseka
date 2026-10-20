import { ObjectId } from 'mongodb'
import type { CurrencyCode } from '@/lib/currency'

export interface ITransaction {
  _id: ObjectId
  userId: string
  amount: number
  currency: CurrencyCode
  type: 'income' | 'expense' | 'savings' | 'transfer' | 'adjustment'
  category: string
  description?: string
  date: Date
  tags: string[]
  isRecurring: boolean
  /** Account this transaction was paid from / deposited into. Null for legacy transactions predating accounts ("Unassigned"). Also null for transfers, which use fromAccountId/toAccountId instead. */
  accountId: ObjectId | null
  /** Transfer only: the account money left. Null for non-transfer transactions. */
  fromAccountId?: ObjectId | null
  /** Transfer only: the account money arrived in. Null for non-transfer transactions. */
  toAccountId?: ObjectId | null
  /** Transfer only: true when the destination account is a savings/time_deposit account, so this transfer counts toward totalSavings/health score alongside type: 'savings' transactions. */
  countsAsSavings?: boolean
  /**
   * Adjustment only: signed change to the account's figure (balance for asset accounts,
   * amount owed for credit cards). `amount` holds its size so lists can show it like any
   * other entry. Adjustments only move the account balance - they are never income,
   * spending or savings, and every report query leaves them out by filtering on type.
   */
  adjustmentDelta?: number
  /** Adjustment only: the balance the user typed in (what their bank showed on `date`). Kept so an edit can re-work the change. */
  adjustmentTarget?: number
  /** Set when this transaction is beyond the user's tier retention window. Archived transactions are retained but excluded from queries. */
  isArchived: boolean
  /** Date this transaction was archived. Null if not archived. */
  archivedAt?: Date
  createdAt: Date
  updatedAt: Date
}
