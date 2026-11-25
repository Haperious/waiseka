import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

/*
 * Re-entering the password before a sensitive change (password, MFA on/off, an admin's
 * MFA reset), so a stolen session cookie alone can't make it. Every such form shares
 * one attempt counter per account - switching forms buys no extra guesses.
 */

export const REAUTH_LIMIT = 5
export const REAUTH_WINDOW_MS = 15 * 60 * 1000
/** Same generous cap as sign-in, so no older long password is refused. */
const MAX_PASSWORD_LENGTH = 1024

/**
 * Null when `password` matches `passwordHash`, else a ready-to-return 400 or 429.
 * Counted before the bcrypt compare, so guesses also can't keep the server hashing.
 */
export async function confirmPassword(
  userId: string,
  passwordHash: string | undefined,
  password: unknown,
): Promise<NextResponse | null> {
  const rl = await rateLimit(`reauth:${userId}`, REAUTH_LIMIT, REAUTH_WINDOW_MS)
  if (!rl.allowed) return tooManyRequests(rl, 'Too many attempts. Please wait a few minutes and try again.')

  if (typeof password !== 'string' || !password || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: 'Enter your current password', code: 'PASSWORD_REQUIRED' }, { status: 400 })
  }
  if (!passwordHash || !(await bcrypt.compare(password, passwordHash))) {
    return NextResponse.json({ error: 'Current password is incorrect', code: 'WRONG_PASSWORD' }, { status: 400 })
  }
  return null
}
