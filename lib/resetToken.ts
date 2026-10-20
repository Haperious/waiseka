import crypto from 'crypto'

/**
 * Password reset tokens are crypto.randomBytes(32) as hex (see forgot-password).
 * Checking the shape before querying keeps request input from reaching Mongo as
 * an operator object like { "$ne": "" }, which would match any outstanding token.
 * Email verification links use the same shape.
 */
export function isResetToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

/**
 * Email-link tokens (password reset, email verification) are stored only as this hash,
 * like the MFA ticket, so a leaked database copy holds no working links.
 */
export function hashEmailToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** A new email-link token: `token` goes in the link, `tokenHash` goes in the database. */
export function createEmailToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex')
  return { token, tokenHash: hashEmailToken(token) }
}
