import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// 5 attempts per IP per 15 minutes
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 15 * 60 * 1000

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
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const db = await getDb()
  const record = await db.collection('passwordResetTokens').findOne({
    token,
    used: false,
    expiresAt: { $gt: new Date() },
  })

  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
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
