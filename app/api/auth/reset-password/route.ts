import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { rateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit'
import { hashEmailToken, isResetToken } from '@/lib/resetToken'
import { newPasswordError } from '@/lib/passwordStrength'
import { readJsonBody } from '@/lib/request'

// 5 attempts per IP per 15 minutes
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 15 * 60 * 1000
// The page checks its link once on load; allow a few reloads per window
const CHECK_RATE_LIMIT = 20

const INVALID_LINK_MESSAGE = 'Invalid or expired reset link'

/** Filter for a link that can still be used. Tokens are stored only as their hash. */
const usableToken = (token: string) => ({
  tokenHash: hashEmailToken(token),
  used: false,
  expiresAt: { $gt: new Date() },
})

/** Lets the reset page show "This link won't work" on load instead of after a submit. */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`reset-password-check:${ip}`, CHECK_RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.allowed) return tooManyRequests(rl)

  const token = new URL(req.url).searchParams.get('token')
  const valid = isResetToken(token) &&
    !!(await (await getDb()).collection('passwordResetTokens').findOne(usableToken(token)))
  return NextResponse.json({ valid })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`reset-password:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.allowed) return tooManyRequests(rl)

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { token, password } = body

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }
  if (!isResetToken(token)) {
    return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 400 })
  }
  const passwordError = newPasswordError(password)
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })

  // Check and burn the link in one step, so two submits at once can't both use it
  const db = await getDb()
  const record = await db.collection('passwordResetTokens').findOneAndUpdate(
    usableToken(token),
    { $set: { used: true } }
  )
  if (!record) {
    return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const now = new Date()

  // passwordChangedAt signs out every existing session (see the jwt callback in auth.ts)
  await db.collection('users').updateOne(
    { _id: new ObjectId(record.userId) },
    { $set: { password: hashed, passwordChangedAt: now, updatedAt: now } }
  )

  return NextResponse.json({ message: 'Password updated successfully' })
}
