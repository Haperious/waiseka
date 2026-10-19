/** 1-4. Length 8+, mixed case, a digit, and a symbol (or 12+ characters) each add a point. */
export function scorePassword(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++
  return Math.max(score, 1)
}
