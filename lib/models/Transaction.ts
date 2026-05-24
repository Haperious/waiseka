import { ObjectId } from 'mongodb'

export interface ITransaction {
  _id: ObjectId
  userId: string
  amount: number
  type: 'income' | 'expense'
  category: string
  description?: string
  date: Date
  tags: string[]
  isRecurring: boolean
  createdAt: Date
  updatedAt: Date
}
