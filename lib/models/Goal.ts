import { ObjectId } from 'mongodb'

export interface IGoal {
  _id: ObjectId
  userId: string
  title: string
  targetAmount: number
  savedAmount: number
  deadline: Date
  priority: 'low' | 'medium' | 'high'
  status: 'active' | 'completed' | 'paused'
  createdAt: Date
  updatedAt: Date
}
