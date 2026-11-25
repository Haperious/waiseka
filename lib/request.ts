import { NextResponse } from 'next/server'
import { cleanUserText } from '@/lib/text'

// Fields are still checked one by one in each route, as before
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonBody = Record<string, any>

/**
 * The request's JSON body as an object, or a ready-to-return 400 when it's missing,
 * malformed, or not an object (req.json() would otherwise throw a 500). Callers just do:
 *
 *   const body = await readJsonBody(req)
 *   if (body instanceof NextResponse) return body
 */
export async function readJsonBody(req: Request): Promise<JsonBody | NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = undefined
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
  }
  return body as JsonBody
}

// ── Field checks for user-entered values ─────────────────────────────────────

/**
 * User-typed text, cleaned (see cleanUserText): null when it isn't a string, shows nothing
 * (spaces, zero-width or other invisible characters only), or is longer than `max`.
 */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = cleanUserText(value)
  return text && text.length <= max ? text : null
}

/**
 * An optional text field: undefined when absent, '' when null or blank (clears it), the
 * cleaned text, or null when it isn't text or is longer than `max`.
 */
export function readOptionalText(
  value: unknown, max: number, opts: { multiline?: boolean } = {},
): string | undefined | null {
  if (value === undefined) return undefined
  if (value === null) return ''
  if (typeof value !== 'string') return null
  const text = cleanUserText(value, opts)
  return text.length <= max ? text : null
}

/** RFC 5321's limit on a deliverable address. */
export const MAX_EMAIL_LENGTH = 254

// Every part excludes the separator that ends it, so there is only one way to match and
// the check runs in linear time. The old /^[^\s@]+@[^\s@]+\.[^\s@]+$/ backtracked
// quadratically: a 40 KB string of dots took about a second of CPU per request.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

/** A trimmed, lowercased email address, or null when it isn't a plausible one. */
export function readEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE.test(email) ? email : null
}

/** A #rgb / #rrggbb colour (alpha digits allowed) - what every colour picker in the app sends. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 })
