import type { Db } from 'mongodb'
import { unstable_update } from '@/auth'
import { issueMfaTicket } from '@/lib/mfa-ticket'

/**
 * Mark the current session as having passed MFA, and stamp it as signed in now so a
 * sessions-revoked-at cut-off set just before (MFA turned on) doesn't sign it out too.
 * The jwt callback in auth.ts only does either after consuming the one-time ticket
 * issued here, so a browser-sent session update can't.
 * Returns false if the session did not end up verified.
 */
export async function markSessionMfaVerified(db: Db, userId: string): Promise<boolean> {
  const ticket = await issueMfaTicket(db, userId)
  const updatedSession = await unstable_update({ mfaTicket: ticket })
  return updatedSession?.user?.mfaVerified === true
}
