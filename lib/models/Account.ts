import { ObjectId } from 'mongodb'

export interface IAccount {
  _id: ObjectId
  userId: string
  name: string
  institution?: string
  type: 'debit' | 'credit' | 'savings' | 'time_deposit' | 'cash' | 'e_wallet'
  /** Anchor for the derived balance calculation - the real balance when the account was added. */
  openingBalance: number
  currency: 'PHP' | 'QAR' | 'USD'
  /** Credit-only. Ignored for all other account types. */
  creditLimit?: number | null
  /** Credit-only. Day of month the payment is due (1-31). Ignored for all other account types. */
  dueDay?: number | null
  /** Opt-in low-balance alert threshold. Alert fires when the derived balance drops below this. Null/unset = no alert. Asset accounts only. */
  lowBalanceThreshold?: number | null
  color?: string | null
  icon?: string | null
  displayOrder: number
  /** Soft delete - archived accounts are hidden from the transaction dropdown and dashboard but keep resolving on historical transactions. */
  isArchived: boolean
  /** Whether this account counts toward the "total money" summary tile. */
  includeInTotal: boolean
  createdAt: Date
  updatedAt: Date
}

export const ACCOUNT_TYPES: IAccount['type'][] = [
  'debit',
  'credit',
  'savings',
  'time_deposit',
  'cash',
  'e_wallet',
]
