import mongoose, { Document, Model } from 'mongoose'

export interface IGoal extends Document {
  userId: string
  title: string
  targetAmount: number
  savedAmount: number
  deadline?: Date
  priority: 'low' | 'medium' | 'high'
  status: 'active' | 'completed' | 'paused'
  createdAt: Date
  updatedAt: Date
}

const GoalSchema = new mongoose.Schema<IGoal>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    savedAmount: { type: Number, default: 0 },
    deadline: { type: Date },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
  },
  { timestamps: true }
)

const Goal: Model<IGoal> = mongoose.models.Goal ?? mongoose.model<IGoal>('Goal', GoalSchema)

export default Goal
