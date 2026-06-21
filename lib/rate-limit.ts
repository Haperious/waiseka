/**
 * In-memory sliding-window rate limiter.
 * State lives in the Next.js process - resets on redeploy.
 * Suitable for single-instance deployments (Netlify, Vercel).
 */

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

// Periodically purge expired entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, win] of store.entries()) {
    if (now >= win.resetAt) store.delete(key)
  }
}, 60_000)

/**
 * Check and increment a rate-limit bucket.
 *
 * @param key      Unique identifier (e.g. `"register:1.2.3.4"`)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 * @returns        `{ allowed: true }` or `{ allowed: false, retryAfterMs: number }`
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now()
  const existing = store.get(key)

  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterMs: existing.resetAt - now }
  }

  existing.count++
  return { allowed: true }
}

/** Extract the client IP from a Next.js request. */
export function getClientIp(req: Request): string {
  return (
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}
