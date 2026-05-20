import mongoose, { Document, Model } from 'mongoose'

export interface ITransaction extends Document {
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

const TransactionSchema = new mongoose.Schema<ITransaction>(
  {
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, required: true },
    description: { type: String },
    date: { type: Date, required: true },
    tags: [{ type: String }],
    isRecurring: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ?? mongoose.model<ITransaction>('Transaction', TransactionSchema)

export default Transaction
