import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { checkMfaRateLimit } from '@/lib/auth-rate-limit'
import { getClientIp, tooManyRequests } from '@/lib/rate-limit'
import { getDb } from '@/lib/mongodb'
import { verifySync, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import { ObjectId } from 'mongodb'
import type { IUser } from '@/lib/models/User'

export async function POST(req: NextRequest) {
  // A session that has only passed the password step must not be able to turn MFA off
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Shares the MFA attempt counter so this can't be used to guess codes around the login limit
  const rateLimitResult = await checkMfaRateLimit(session.user.id, getClientIp(req))
  if (!rateLimitResult.allowed) {
    return tooManyRequests(rateLimitResult, 'Too many attempts. Please wait a few minutes and try again.')
  }

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { token } = body

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'TOTP token is required to disable MFA' }, { status: 400 })
  }

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { mfa: 1 } })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!user.mfa?.enabled) return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 })

  // verifySync returns a result object (always truthy) - the verdict is `.valid`
  let isValid = false
  try {
    isValid = verifySync({ token, secret: user.mfa.secret, strategy: 'totp', crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() }).valid
  } catch {
    // Malformed token (wrong length, non-digits) throws rather than returning invalid
  }
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
  }

  await db.collection<IUser>('users').updateOne(
    { _id: user._id },
    { $unset: { mfa: '' } }
  )

  return NextResponse.json({ success: true })
}
