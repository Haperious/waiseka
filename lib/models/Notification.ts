import { ObjectId } from 'mongodb'

export interface INotification {
  _id: ObjectId
  userId: string
  type: 'budget_alert' | 'low_balance' | 'credit_utilization'
  /** For budget alerts this is the spending category; unused for account alerts. */
  category: string
  message: string
  color: string
  /** Account alerts only: the account this alert is about (used for display + dedup). */
  accountId?: string
  /** Account alerts only: stable dedup discriminator (e.g. 'low_balance', 'util_70', 'util_90'). */
  alertKey?: string
  createdAt: Date
  read: boolean
}
