import { ObjectId } from 'mongodb'

export interface ICategory {
  _id: ObjectId
  userId: string
  name: string
  type: 'income' | 'expense' | 'both'
  color: string
  createdAt: Date
  updatedAt: Date
}

export const DEFAULT_CATEGORIES: Omit<ICategory, '_id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  // Expense
  { name: 'Food & Dining',      type: 'expense', color: '#f97316' },
  { name: 'Transportation',     type: 'expense', color: '#3b82f6' },
  { name: 'Housing',            type: 'expense', color: '#8b5cf6' },
  { name: 'Entertainment',      type: 'expense', color: '#ec4899' },
  { name: 'Health & Fitness',   type: 'expense', color: '#22c55e' },
  { name: 'Shopping',           type: 'expense', color: '#ef4444' },
  { name: 'Utilities',          type: 'expense', color: '#14b8a6' },
  { name: 'Education',          type: 'expense', color: '#f59e0b' },
  { name: 'Travel',             type: 'expense', color: '#06b6d4' },
  { name: 'Personal Care',      type: 'expense', color: '#a855f7' },
  { name: 'Gifts & Donations',  type: 'expense', color: '#e11d48' },
  { name: 'Business',           type: 'expense', color: '#0ea5e9' },
  // Income
  { name: 'Salary',             type: 'income',  color: '#22c55e' },
  { name: 'Freelance',          type: 'income',  color: '#3b82f6' },
  { name: 'Investment',         type: 'income',  color: '#f59e0b' },
  { name: 'Business Income',    type: 'income',  color: '#8b5cf6' },
  // Both
  { name: 'Other',              type: 'both',    color: '#6b7280' },
]
