import mongoose, { Document, Model } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password: string
  avatar?: string
  role: 'user' | 'admin'
  isVerified: boolean
  preferences: {
    currency: 'PHP' | 'QAR' | 'USD'
    currencySymbol: string
  }
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    avatar: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    preferences: {
      currency: {
        type: String,
        enum: ['PHP', 'QAR', 'USD'],
        default: 'USD',
      },
      currencySymbol: {
        type: String,
        default: '$',
      },
    },
  },
  { timestamps: true }
)

const CURRENCY_SYMBOL_MAP: Record<string, string> = { PHP: '₱', QAR: '﷼', USD: '$' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
UserSchema.pre('save', function (this: any, next: any) {
  if (this.isModified('preferences.currency')) {
    this.preferences.currencySymbol = CURRENCY_SYMBOL_MAP[this.preferences.currency] ?? '$'
  }
  next()
})

const User: Model<IUser> = mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema)

export default User
