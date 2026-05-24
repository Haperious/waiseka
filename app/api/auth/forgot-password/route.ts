import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getDb } from '@/lib/mongodb'
import { sendResetPasswordEmail } from '@/lib/email'
import type { IUser } from '@/lib/models/User'

const EXPIRY_MINUTES = 30

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOne({ email: email.toLowerCase() })

  // Always return 200 to prevent email enumeration
  if (!user) return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000)

  await db.collection('passwordResetTokens').insertOne({
    userId: user._id.toString(),
    token,
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

  const resetUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/reset-password?token=${token}`
  const firstName = user.name.split(' ')[0]

  sendResetPasswordEmail({
    firstName,
    email: user.email,
    resetUrl,
    expiryMinutes: EXPIRY_MINUTES,
    requestedAt,
    deviceInfo,
    locationApprox: 'Location unavailable',
  }).catch((err) => console.error('[forgot-password] email error:', err))

  return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' })
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
