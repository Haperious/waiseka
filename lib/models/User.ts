import { ObjectId } from 'mongodb'

export interface IConversationMessage {
  role: string
  content: string
  createdAt: Date
}

export type OnboardingStepId =
  | 'dashboard'
  | 'transactions'
  | 'categories'
  | 'goals'

export interface IOnboarding {
  completedAt: Date | null
  stepsCompleted: OnboardingStepId[]
  dismissed: boolean
}

export interface IUser {
  _id: ObjectId
  name: string
  email: string
  password: string
  avatar?: string
  role: 'user' | 'admin'
  isVerified: boolean
  tier: 'free' | 'premium'
  premiumOverride: boolean
  isAdmin: boolean
  preferences: {
    currency: 'PHP' | 'QAR' | 'USD'
    currencySymbol: string
    theme?: 'light' | 'dark'
  }
  onboarding: IOnboarding
  ai: {
    enabled: boolean
    queriesUsed: number
    queriesCapOverride: number | null
    resetDate: Date
    conversations: IConversationMessage[]
  }
  notifications: {
    email: {
      enabled: boolean
      frequency: 'daily' | 'weekly' | 'monthly'
      count?: number
      /** @deprecated use lastSentBudget / lastSentReEngage / lastSentMonthly */
      lastSent?: Date
      lastSentBudget?: Date
      lastSentReEngage?: Date
      lastSentMonthly?: Date
    }
    push: {
      enabled: boolean
      frequency: 'daily' | 'weekly' | 'monthly'
      fcmToken: string | null
    }
    lastSeen: Date
  }
  importUsage?: {
    count: number
    resetAt: Date
  }
  passwordChangedAt?: Date
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
}

export const CURRENCY_SYMBOL_MAP: Record<string, string> = { PHP: '₱', QAR: '﷼', USD: '$' }
