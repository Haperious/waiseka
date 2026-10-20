import crypto from 'crypto'
import type { Db } from 'mongodb'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

/**
 * Fixed-window rate limiter backed by MongoDB, so every serverless instance shares one
 * count. The old in-memory Map was per instance: each warm Netlify container kept its own
 * tally, so the real limit grew with the number of containers serving the requests.
 *
 * Each key is one document `{ _id: sha256(key), count, resetAt }` - hashed because login
 * keys contain email addresses - and a TTL index on `resetAt` lets
 * Mongo delete windows that have ended. If the database can't be reached, the same window
 * logic runs in memory instead, so a database blip doesn't lock everyone out.
 */

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number }

interface RateLimitDoc {
  _id: string
  count: number
  resetAt: Date
}

const COLLECTION = 'rateLimits'

let indexReady: Promise<unknown> | null = null

function ensureTtlIndex(db: Db): Promise<unknown> {
  indexReady ??= db
    .collection<RateLimitDoc>(COLLECTION)
    .createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 })
    .catch((err) => {
      indexReady = null
      throw err
    })
  return indexReady
}

async function rateLimitInDb(key: string, limit: number, windowMs: number, now: Date): Promise<RateLimitResult> {
  const db = await getDb()
  await ensureTtlIndex(db)

  // One atomic round trip: start a fresh window if there is none or it has ended,
  // otherwise count this request in the current one. Expressions in a single $set all
  // read the document as it was, so `resetAt` below sees the old value.
  const windowOver = { $lte: [{ $ifNull: ['$resetAt', new Date(0)] }, now] }
  const doc = await db.collection<RateLimitDoc>(COLLECTION).findOneAndUpdate(
    { _id: crypto.createHash('sha256').update(key).digest('hex') },
    [{
      $set: {
        count: { $cond: [windowOver, 1, { $add: ['$count', 1] }] },
        resetAt: { $cond: [windowOver, new Date(now.getTime() + windowMs), '$resetAt'] },
      },
    }],
    { upsert: true, returnDocument: 'after' }
  )
  if (!doc) throw new Error('rate limit upsert returned no document')

  return doc.count > limit
    ? { allowed: false, retryAfterMs: Math.max(0, doc.resetAt.getTime() - now.getTime()) }
    : { allowed: true }
}

// ── In-memory fallback ────────────────────────────────────────────────────────

const memoryStore = new Map<string, { count: number; resetAt: number }>()

// Purge ended windows so the fallback can't grow without bound. unref() keeps this
// timer from holding a serverless function or test run open.
setInterval(() => {
  const now = Date.now()
  for (const [key, win] of memoryStore) {
    if (now >= win.resetAt) memoryStore.delete(key)
  }
}, 60_000).unref?.()

function rateLimitInMemory(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const existing = memoryStore.get(key)
  if (!existing || now >= existing.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }
  if (existing.count >= limit) return { allowed: false, retryAfterMs: existing.resetAt - now }
  existing.count++
  return { allowed: true }
}

/**
 * Check and count one request against a rate-limit bucket.
 *
 * @param key      Unique identifier (e.g. `"register:1.2.3.4"`)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = new Date()
  try {
    return await rateLimitInDb(key, limit, windowMs, now)
  } catch (err) {
    console.warn('[rate-limit] database unavailable, using in-memory limit:', err instanceof Error ? err.message : err)
    return rateLimitInMemory(key, limit, windowMs, now.getTime())
  }
}

/** The 429 response for a request `rateLimit()` turned away. */
export function tooManyRequests(
  result: { retryAfterMs: number },
  message = 'Too many requests. Please try again later.'
): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } }
  )
}

/**
 * Extract the client IP from a Next.js request.
 *
 * On Netlify, x-nf-client-connection-ip is set by Netlify itself and is the only IP header
 * it guarantees. x-forwarded-for can carry a value the client sent, so trusting it first
 * would let anyone dodge the per-IP rate limits by sending a different header each request.
 * The fallbacks cover local dev and other hosts.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-nf-client-connection-ip')?.trim() ||
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}
