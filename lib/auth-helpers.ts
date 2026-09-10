import type { Session } from 'next-auth'
import { auth } from '@/auth'

/**
 * Like `auth()`, but also enforces the post-password MFA gate: an MFA-enabled account
 * that hasn't completed its TOTP/backup-code step yet gets treated as unauthenticated,
 * not just unverified. Drop-in replacement for `auth()` in protected API routes.
 */
export async function requireVerifiedSession(): Promise<Session | null> {
  const session = await auth()
  if (!session) return null
  if (session.user.mfaVerified === false) return null
  return session
}
