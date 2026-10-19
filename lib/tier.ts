import { FREE_HISTORY_DAYS, PREMIUM_HISTORY_DAYS } from '@/lib/constants'

export function isPremium(user: { tier: string; premiumOverride: boolean }): boolean {
  return user.tier === 'premium' || user.premiumOverride === true
}

/**
 * Start (UTC midnight) of the rolling transaction-history window for a tier -
 * anything dated before this is outside what the user may query or create.
 */
export function historyWindowStart(premium: boolean, now: Date = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - (premium ? PREMIUM_HISTORY_DAYS : FREE_HISTORY_DAYS))
  start.setUTCHours(0, 0, 0, 0)
  return start
}
