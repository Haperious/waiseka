import { ObjectId } from 'mongodb'

export interface ISurvey {
  _id: ObjectId
  userId: ObjectId
  rating: 1 | 2 | 3 | 4 | 5
  comment?: string
  createdAt: Date
}
