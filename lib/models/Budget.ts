import { ObjectId } from 'mongodb'

export interface IBudget {
  _id: ObjectId
  userId: string
  category: string
  limit: number
  period: 'monthly' | 'weekly'
  /** Missing = the user's primary currency (budgets created before multi-currency). Only same-currency expenses count. */
  currency?: 'PHP' | 'QAR' | 'USD'
  spent: number
  color?: string
  createdAt: Date
  updatedAt: Date
}
