import { ObjectId } from 'mongodb'
import type { CurrencyCode } from '@/lib/currency'

export interface IGoal {
  _id: ObjectId
  userId: string
  title: string
  targetAmount: number
  savedAmount: number
  /** Missing = the user's primary currency (goals created before multi-currency). */
  currency?: CurrencyCode
  deadline: Date
  priority: 'low' | 'medium' | 'high'
  status: 'active' | 'completed' | 'paused'
  createdAt: Date
  updatedAt: Date
}
