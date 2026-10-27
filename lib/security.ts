import crypto from 'crypto'

/**
 * Constant-time check of a caller-supplied secret against the configured one, so response
 * timing can't reveal how much of a guess was right. False when either side is missing or
 * empty - a route whose secret env var isn't set must never accept requests.
 */
export function secretMatches(provided: unknown, secret: string | undefined): boolean {
  if (typeof provided !== 'string' || !provided || !secret) return false
  // Hashing first gives equal-length buffers, which timingSafeEqual requires
  const digest = (value: string) => crypto.createHash('sha256').update(value).digest()
  return crypto.timingSafeEqual(digest(provided), digest(secret))
}

/** Text with every regex special character escaped, so user input matches only literally. */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
