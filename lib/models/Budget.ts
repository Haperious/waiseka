import { ObjectId } from 'mongodb'
import type { CurrencyCode } from '@/lib/currency'

export interface IBudget {
  _id: ObjectId
  userId: string
  category: string
  limit: number
  period: 'monthly' | 'weekly'
  /** Missing = the user's primary currency (budgets created before multi-currency). Only same-currency expenses count. */
  currency?: CurrencyCode
  spent: number
  color?: string
  createdAt: Date
  updatedAt: Date
}
