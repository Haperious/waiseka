import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { sendResetPasswordEmail } from '@/lib/email'
import { rateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit'
import type { IUser } from '@/lib/models/User'
import { logEmail } from '@/lib/models/EmailLog'
import { APP_URL } from '@/lib/app-url'
import { createEmailToken } from '@/lib/resetToken'
import { readJsonBody } from '@/lib/request'

const EXPIRY_MINUTES = 30
// 3 requests per IP per 15 minutes
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 15 * 60 * 1000
// 3 reset emails per address per hour, from any number of IPs
const EMAIL_RATE_LIMIT = 3
const EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000

const GENERIC_REPLY = 'If that email exists, a reset link has been sent.'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`forgot-password:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.allowed) return tooManyRequests(rl)

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { email } = body
  if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // The per-IP limit alone lets someone with many IPs flood one inbox. Over this limit the
  // request gets the usual reply but sends nothing - the same for any email, registered or
  // not, so it can't be used to tell which emails have accounts.
  // Trimmed like sign-up does, so a pasted " me@x.com " still finds the account
  const normalizedEmail = email.trim().toLowerCase()
  const perEmail = await rateLimit(`forgot-password:email:${normalizedEmail}`, EMAIL_RATE_LIMIT, EMAIL_RATE_WINDOW_MS)
  if (!perEmail.allowed) return NextResponse.json({ message: GENERIC_REPLY })

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOne({ email: normalizedEmail })

  // Always return 200 to prevent email enumeration
  if (!user) return NextResponse.json({ message: GENERIC_REPLY })

  const { token, tokenHash } = createEmailToken()
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000)

  // Invalidate any previous unused tokens for this user so only the latest link works
  await db.collection('passwordResetTokens').updateMany(
    { userId: user._id.toString(), used: false },
    { $set: { used: true } }
  )

  await db.collection('passwordResetTokens').insertOne({
    userId: user._id.toString(),
    tokenHash,
    expiresAt,
    used: false,
    createdAt: new Date(),
  })

  const ua = req.headers.get('user-agent') ?? 'Unknown device'
  const deviceInfo = parseUserAgent(ua)
  const requestedAt = new Date().toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  const resetUrl = `${APP_URL}/reset-password?token=${token}`
  const firstName = user.name.split(' ')[0]

  sendResetPasswordEmail({
    firstName,
    email: user.email,
    resetUrl,
    expiryMinutes: EXPIRY_MINUTES,
    requestedAt,
    deviceInfo,
    locationApprox: 'Location unavailable',
  })
    .then(() => logEmail(db, { userId: user._id.toString(), type: 'reset_password' }))
    .catch((err) => console.error('[forgot-password] email error:', err))

  return NextResponse.json({ message: GENERIC_REPLY })
}

function parseUserAgent(ua: string): string {
  const browser = ua.includes('Chrome') ? 'Chrome'
    : ua.includes('Firefox') ? 'Firefox'
    : ua.includes('Safari') ? 'Safari'
    : ua.includes('Edge') ? 'Edge'
    : 'Unknown browser'
  const os = ua.includes('Windows') ? 'Windows'
    : ua.includes('Mac') ? 'macOS'
    : ua.includes('Android') ? 'Android'
    : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'
    : ua.includes('Linux') ? 'Linux'
    : 'Unknown OS'
  return `${browser} on ${os}`
}
