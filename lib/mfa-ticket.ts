import crypto from 'crypto'
import { ObjectId, type Db } from 'mongodb'
import type { IUser } from '@/lib/models/User'

/**
 * One-time proof that the MFA step succeeded on the server.
 *
 * The session's `mfaVerified` flag is flipped through the next-auth `update`
 * trigger, whose payload a browser can also send (POST /api/auth/session), so
 * the payload alone can never be trusted. Instead /api/auth/mfa/validate-session
 * issues a random ticket after checking the code and stores only its hash;
 * the jwt callback flips the flag only after atomically consuming that ticket.
 */

/** Long enough for the update call that immediately follows; short enough to be useless if leaked. */
export const MFA_TICKET_TTL_MS = 60 * 1000

const MFA_TICKET_BYTES = 32

export function hashMfaTicket(ticket: string): string {
  return crypto.createHash('sha256').update(ticket).digest('hex')
}

/** Create a ticket for this user, replacing any earlier unused one. Returns the plain ticket. */
export async function issueMfaTicket(db: Db, userId: string, now: Date = new Date()): Promise<string> {
  const ticket = crypto.randomBytes(MFA_TICKET_BYTES).toString('hex')
  await db.collection<IUser>('users').updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        'mfa.pendingTicket': {
          tokenHash: hashMfaTicket(ticket),
          expiresAt: new Date(now.getTime() + MFA_TICKET_TTL_MS),
        },
      },
    }
  )
  return ticket
}

/**
 * Atomically check and delete the user's ticket. True only for an unexpired
 * ticket that matches - a ticket can never be used twice.
 */
export async function consumeMfaTicket(db: Db, userId: string, ticket: string, now: Date = new Date()): Promise<boolean> {
  if (!ObjectId.isValid(userId)) return false

  const consumed = await db.collection<IUser>('users').findOneAndUpdate(
    {
      _id: new ObjectId(userId),
      'mfa.enabled': true,
      'mfa.pendingTicket.tokenHash': hashMfaTicket(ticket),
      'mfa.pendingTicket.expiresAt': { $gt: now },
    },
    { $unset: { 'mfa.pendingTicket': '' } },
    { projection: { _id: 1 } }
  )
  return consumed !== null
}
