import { ObjectId } from 'mongodb'

export interface IConversationMessage {
  role: string
  content: string
  createdAt: Date
}

export type OnboardingStepId =
  | 'accounts'
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
    /** Account pre-selected on the transaction form. Null/unset falls back to the oldest debit account, if any. */
    defaultAccountId?: string | null
    /** Accounts excluded from the transactions-page balance strip. Exclusion list - empty/unset shows all non-archived accounts. */
    transactionsHiddenAccountIds?: string[]
    /** Whether the transactions-page balance strip is collapsed. */
    transactionsAccountStripCollapsed?: boolean
    /** Pay-cutoff schedule used to compute the dashboard's "safe to spend per day" period. */
    cutoffMode?: 'semi-monthly' | 'monthly' | 'custom'
    /** Day-of-month cutoffs, e.g. [15, 30] for semi-monthly. A value >=30 stands for "end of month". */
    cutoffDays?: number[]
    cutoffAnchorDate?: string
    /** Default view shown on the monthly reports page. */
    reportsDefaultView?: 'chart' | 'table'
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
  mfa?: {
    enabled: boolean
    secret: string        // TOTP secret (base32)
    backupCodes: string[] // hashed backup codes
    enabledAt: Date
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
