import type { Db, ObjectId } from 'mongodb'
import { sendMfaChangedEmail, type MfaChange } from '@/lib/email'
import { logEmail } from '@/lib/models/EmailLog'
import { runAfterResponse } from '@/lib/background'
import { describeUserAgent } from '@/lib/userAgent'

/**
 * Tell the account owner their two-factor setting changed, after the response is sent.
 * Every change emails them, so a takeover can't happen silently.
 * `userAgent` is the request's; leave it out for an admin reset (it'd be the admin's device).
 */
export function notifyMfaChange(
  db: Db,
  user: { _id: ObjectId; name?: string; email?: string },
  change: MfaChange,
  userAgent?: string | null,
): void {
  const email = user.email
  if (!email) return
  const occurredAt = new Date().toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  })
  runAfterResponse('mfa change email', async () => {
    await sendMfaChangedEmail({
      firstName: user.name?.split(' ')[0] || 'there',
      email,
      change,
      occurredAt,
      deviceInfo: userAgent === undefined ? undefined : describeUserAgent(userAgent),
    })
    await logEmail(db, { userId: user._id.toString(), type: 'mfa_changed' })
  })
}
