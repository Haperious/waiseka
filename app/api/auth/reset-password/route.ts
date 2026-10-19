import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { isResetToken } from '@/lib/resetToken'

// 5 attempts per IP per 15 minutes
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 15 * 60 * 1000
// The page checks its link once on load; allow a few reloads per window
const CHECK_RATE_LIMIT = 20

const INVALID_LINK_MESSAGE = 'Invalid or expired reset link'

function findUsableToken(token: string) {
  return getDb().then((db) =>
    db.collection('passwordResetTokens').findOne({ token, used: false, expiresAt: { $gt: new Date() } })
  )
}

/** Lets the reset page show "This link won't work" on load instead of after a submit. */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`reset-password-check:${ip}`, CHECK_RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const token = new URL(req.url).searchParams.get('token')
  const valid = isResetToken(token) && !!(await findUsableToken(token))
  return NextResponse.json({ valid })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`reset-password:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const { token, password } = await req.json()

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }
  if (!isResetToken(token)) {
    return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const db = await getDb()
  const record = await findUsableToken(token)

  if (!record) {
    return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 12)

  await Promise.all([
    db.collection('users').updateOne(
      { _id: new ObjectId(record.userId) },
      { $set: { password: hashed, updatedAt: new Date() } }
    ),
    db.collection('passwordResetTokens').updateOne(
      { _id: record._id },
      { $set: { used: true } }
    ),
  ])

  return NextResponse.json({ message: 'Password updated successfully' })
}
