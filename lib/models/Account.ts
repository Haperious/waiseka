import { ObjectId } from 'mongodb'
import type { CurrencyCode } from '@/lib/currency'

export interface IAccount {
  _id: ObjectId
  userId: string
  name: string
  institution?: string
  type: 'debit' | 'credit' | 'savings' | 'time_deposit' | 'cash' | 'e_wallet'
  /** Anchor for the derived balance calculation - the real balance when the account was added. */
  openingBalance: number
  /**
   * Day the opening balance was true on. Entries dated before it are already inside the
   * opening balance, so they don't move the balance. Unset on accounts made before this
   * field existed - those keep counting every entry.
   */
  openingBalanceDate?: Date | null
  /**
   * When the user last confirmed WaiseKa matched their bank (a "Yes, matches" check, a
   * balance adjustment, or adding the account). Drives the "Verified 3 days ago" badge and
   * the reminder to check again. Unset on older accounts = never checked.
   */
  lastVerifiedAt?: Date | null
  /** The figure the user confirmed (balance, or amount owed for cards). Null when the check was adding the account. */
  lastVerifiedBalance?: number | null
  /** The day that figure was for. If the figure on this day later differs, history changed after the check. */
  lastVerifiedDate?: Date | null
  currency: CurrencyCode
  /** Credit-only. Ignored for all other account types. */
  creditLimit?: number | null
  /** Credit-only. Day of month the payment is due (1-31). Ignored for all other account types. */
  dueDay?: number | null
  /** Credit-only. Day of month the statement closes (1-31). Drives the "check your statement" prompt. */
  statementDay?: number | null
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
