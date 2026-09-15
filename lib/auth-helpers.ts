import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { adminGate } from '@/lib/admin-gate'

// Route handlers each get their own request/invocation, so React's cache() can't dedupe
// across them. Instead, share the same in-flight auth() promise (and its result, briefly)
// across whichever of the 4-6 dashboard routes land on this warm container within a few
// seconds of each other. auth() re-runs the jwt callback's passwordChangedAt lookup on every
// call, so this is what collapses those into ~1 DB round trip per page load.
const SESSION_CACHE_TTL_MS = 5_000

type SessionCacheEntry = { promise: Promise<Session | null>; expiresAt: number }

declare global {
  // eslint-disable-next-line no-var
  var _sessionCache: Map<string, SessionCacheEntry> | undefined
}

// Stashed on `global` (like lib/mongodb.ts's client) rather than a bare module variable,
// so it survives dev-mode Fast Refresh module reloads between requests - otherwise every
// route navigation looks like a fresh module and the cache never outlives a single burst.
const sessionCache: Map<string, SessionCacheEntry> = global._sessionCache ?? new Map()
global._sessionCache = sessionCache

async function getSessionCookieValue(): Promise<string | undefined> {
  const store = await cookies()
  return (
    store.get('authjs.session-token')?.value ??
    store.get('__Secure-authjs.session-token')?.value
  )
}

function pruneExpired(now: number): void {
  for (const [key, entry] of sessionCache) {
    if (entry.expiresAt <= now) sessionCache.delete(key)
  }
}

async function resolveVerifiedSession(): Promise<Session | null> {
  const session = await auth()
  if (!session) return null
  if (session.user.mfaVerified === false) return null
  return session
}

/**
 * Like `auth()`, but also enforces the post-password MFA gate: an MFA-enabled account
 * that hasn't completed its TOTP/backup-code step yet gets treated as unauthenticated,
 * not just unverified. Drop-in replacement for `auth()` in protected API routes.
 *
 * Also memoizes the underlying auth()/jwt-callback lookup for a few seconds per session
 * cookie, so the several near-simultaneous route calls a single page load makes collapse
 * into one DB read instead of one each.
 */
export async function requireVerifiedSession(): Promise<Session | null> {
  const cookieValue = await getSessionCookieValue()
  if (!cookieValue) return resolveVerifiedSession()

  const now = Date.now()
  const cached = sessionCache.get(cookieValue)
  if (cached && cached.expiresAt > now) return cached.promise

  if (sessionCache.size > 500) pruneExpired(now)

  const promise = resolveVerifiedSession()
  sessionCache.set(cookieValue, { promise, expiresAt: now + SESSION_CACHE_TTL_MS })
  return promise
}

/**
 * Combines `requireVerifiedSession()` with `adminGate()` for the ~11 admin-only routes
 * that need both. Returns the verified admin `Session` on success, or a ready-to-return
 * 403 `NextResponse` on failure — callers just do:
 *
 *   const session = await requireAdminSession()
 *   if (session instanceof NextResponse) return session
 */
export async function requireAdminSession(): Promise<Session | NextResponse> {
  const session = await requireVerifiedSession()
  try {
    adminGate(session)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return session as Session
}
