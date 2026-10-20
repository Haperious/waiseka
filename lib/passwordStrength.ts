/** 1-4. Length 8+, mixed case, a digit, and a symbol (or 12+ characters) each add a point. */
export function scorePassword(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++
  return Math.max(score, 1)
}

export const MIN_PASSWORD_LENGTH = 8
/** bcrypt only reads the first 72 bytes; the cap stops huge inputs costing hashing time. */
export const MAX_PASSWORD_LENGTH = 128

/** The server-side rule for a new password: the error to show, or null when it's fine. */
export function newPasswordError(password: unknown, subject = 'Password'): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `${subject} must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `${subject} must be ${MAX_PASSWORD_LENGTH} characters or fewer`
  }
  return null
}
