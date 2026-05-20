import mongoose, { Document, Model } from 'mongoose'

export interface IBudget extends Document {
  userId: string
  category: string
  limit: number
  period: 'monthly' | 'weekly'
  spent: number
  color?: string
  createdAt: Date
  updatedAt: Date
}

const BudgetSchema = new mongoose.Schema<IBudget>(
  {
    userId: { type: String, required: true, index: true },
    category: { type: String, required: true },
    limit: { type: Number, required: true },
    period: { type: String, enum: ['monthly', 'weekly'], default: 'monthly' },
    spent: { type: Number, default: 0 },
    color: { type: String },
  },
  { timestamps: true }
)

const Budget: Model<IBudget> =
  mongoose.models.Budget ?? mongoose.model<IBudget>('Budget', BudgetSchema)

export default Budget
