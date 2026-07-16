import { ObjectId } from 'mongodb'

export interface ITransaction {
  _id: ObjectId
  userId: string
  amount: number
  currency: 'PHP' | 'QAR' | 'USD'
  type: 'income' | 'expense' | 'savings' | 'transfer'
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
  /** Set when this transaction is beyond the user's tier retention window. Archived transactions are retained but excluded from queries. */
  isArchived: boolean
  /** Date this transaction was archived. Null if not archived. */
  archivedAt?: Date
  createdAt: Date
  updatedAt: Date
}
