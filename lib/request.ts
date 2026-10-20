import { NextResponse } from 'next/server'

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

/** User-typed text, trimmed: null when it isn't a string, is empty, or is longer than `max`. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text && text.length <= max ? text : null
}

/** An optional text field: absent, null, or a string of at most `max` characters ('' clears it). */
export function isOptionalText(value: unknown, max: number): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.length <= max)
}

/** A #rgb / #rrggbb colour (alpha digits allowed) - what every colour picker in the app sends. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
}

export function isPositiveAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** A date string `new Date()` can read, or null. */
export function parseDateField(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 })
