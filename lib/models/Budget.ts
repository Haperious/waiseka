import { ObjectId } from 'mongodb'

export interface IBudget {
  _id: ObjectId
  userId: string
  category: string
  limit: number
  period: 'monthly' | 'weekly'
  spent: number
  color?: string
  createdAt: Date
  updatedAt: Date
}
