import { ObjectId } from 'mongodb'

export interface ITransaction {
  _id: ObjectId
  userId: string
  amount: number
  currency: 'PHP' | 'QAR' | 'USD'
  type: 'income' | 'expense' | 'savings'
  category: string
  description?: string
  date: Date
  tags: string[]
  isRecurring: boolean
  /** Set when this transaction is beyond the user's tier retention window. Archived transactions are retained but excluded from queries. */
  isArchived: boolean
  /** Date this transaction was archived. Null if not archived. */
  archivedAt?: Date
  createdAt: Date
  updatedAt: Date
}
