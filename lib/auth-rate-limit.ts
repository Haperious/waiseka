import { rateLimit, type RateLimitResult } from '@/lib/rate-limit'

/**
 * Brute-force limits for the sign-in flow. Each check is keyed both per
 * account and per IP: the account key stops guessing one user's password or
 * TOTP from many IPs, the IP key stops one client spraying many accounts.
 *
 * Successful attempts count too - the limits are high enough that a real user
 * never hits them, and it keeps the limiter a single increment-and-check.
 */

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

export const LOGIN_RATE_WINDOW_MS = FIFTEEN_MINUTES_MS
export const LOGIN_LIMIT_PER_EMAIL = 10
export const LOGIN_LIMIT_PER_IP = 30

export const MFA_RATE_WINDOW_MS = FIFTEEN_MINUTES_MS
export const MFA_LIMIT_PER_USER = 10
export const MFA_LIMIT_PER_IP = 30

export type AuthRateLimitResult = RateLimitResult

/** Every check is counted (not just up to the first that blocks), so both keys keep advancing. */
async function checkAll(checks: { key: string; limit: number; windowMs: number }[]): Promise<AuthRateLimitResult> {
  const results = await Promise.all(checks.map(({ key, limit, windowMs }) => rateLimit(key, limit, windowMs)))
  let longestRetryMs = 0
  for (const result of results) {
    if (!result.allowed) longestRetryMs = Math.max(longestRetryMs, result.retryAfterMs)
  }
  return longestRetryMs > 0 ? { allowed: false, retryAfterMs: longestRetryMs } : { allowed: true }
}

/** Count one credentials sign-in attempt for this email and IP. */
export function checkLoginRateLimit(email: string, ip: string): Promise<AuthRateLimitResult> {
  return checkAll([
    { key: `login:email:${email.trim().toLowerCase()}`, limit: LOGIN_LIMIT_PER_EMAIL, windowMs: LOGIN_RATE_WINDOW_MS },
    { key: `login:ip:${ip}`, limit: LOGIN_LIMIT_PER_IP, windowMs: LOGIN_RATE_WINDOW_MS },
  ])
}

/** Count one MFA code attempt for this user and IP. */
export function checkMfaRateLimit(userId: string, ip: string): Promise<AuthRateLimitResult> {
  return checkAll([
    { key: `mfa:user:${userId}`, limit: MFA_LIMIT_PER_USER, windowMs: MFA_RATE_WINDOW_MS },
    { key: `mfa:ip:${ip}`, limit: MFA_LIMIT_PER_IP, windowMs: MFA_RATE_WINDOW_MS },
  ])
}
