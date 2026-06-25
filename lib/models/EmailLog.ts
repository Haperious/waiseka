import { ObjectId } from 'mongodb'

export type EmailLogType =
  | 'welcome'           // sent on account creation
  | 'email_verification'// sent on register + resend
  | 'reset_password'    // sent on forgot-password request
  | 'setup_nudge'       // combined no-budget / no-goals marketing email
  | 'budget_reminder'
  | 'spending_alert'
  | 'monthly_report'
  | 're_engage'
  | 'savings_milestone'

export interface IEmailLog {
  _id: ObjectId
  userId: string
  type: EmailLogType
  /** Populated for spending_alert- enables per-category dedup within a month */
  category?: string
  sentAt: Date
}
