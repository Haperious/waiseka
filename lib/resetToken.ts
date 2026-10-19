/**
 * Password reset tokens are crypto.randomBytes(32) as hex (see forgot-password).
 * Checking the shape before querying keeps request input from reaching Mongo as
 * an operator object like { "$ne": "" }, which would match any outstanding token.
 */
export function isResetToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}
