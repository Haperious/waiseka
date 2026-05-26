import { ObjectId } from 'mongodb'

export interface INotification {
  _id: ObjectId
  userId: string
  type: 'budget_alert'
  category: string
  message: string
  color: string
  createdAt: Date
  read: boolean
}
