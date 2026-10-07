import { NextRequest, NextResponse } from 'next/server'
import { auth, unstable_update } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { verify, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import { ObjectId, type Db } from 'mongodb'
import crypto from 'crypto'
import type { IUser } from '@/lib/models/User'
import { checkMfaRateLimit } from '@/lib/auth-rate-limit'
import { getClientIp } from '@/lib/rate-limit'
import { issueMfaTicket } from '@/lib/mfa-ticket'

const otpCrypto = new NobleCryptoPlugin()
const otpBase32 = new ScureBase32Plugin()

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

async function verifyTotp(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ token, secret, strategy: 'totp', crypto: otpCrypto, base32: otpBase32 })
    return result.valid
  } catch {
    return false
  }
}

const VERIFICATION_FAILED_MESSAGE = 'Could not complete verification. Please try again.'

/**
 * Flip the session's mfaVerified flag. The jwt callback only does so after
 * consuming the one-time ticket issued here, so a browser-sent update can't.
 * Returns false if the session did not end up verified.
 */
async function markSessionMfaVerified(db: Db, userId: string): Promise<boolean> {
  const ticket = await issueMfaTicket(db, userId)
  const updatedSession = await unstable_update({ mfaTicket: ticket })
  return updatedSession?.user?.mfaVerified === true
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitResult = checkMfaRateLimit(session.user.id, getClientIp(req))
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimitResult.retryAfterMs / 1000)) } }
    )
  }

  const body = await req.json()
  const { token } = body

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const normalised = token.replace(/-/g, '').trim()

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { mfa: 1 } })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!user.mfa?.enabled) {
    return NextResponse.json({ error: 'MFA is not enabled for this account' }, { status: 400 })
  }

  if (/^\d{6}$/.test(normalised)) {
    const totpValid = await verifyTotp(normalised, user.mfa.secret)
    if (totpValid) {
      if (!(await markSessionMfaVerified(db, session.user.id))) {
        return NextResponse.json({ error: VERIFICATION_FAILED_MESSAGE }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }
  }

  if (/^[A-Fa-f0-9]{8}$/.test(normalised)) {
    const hashed = hashBackupCode(normalised.toUpperCase())
    const backupIndex = user.mfa.backupCodes.indexOf(hashed)

    if (backupIndex !== -1) {
      const updatedCodes = [...user.mfa.backupCodes]
      updatedCodes.splice(backupIndex, 1)
      await db.collection<IUser>('users').updateOne(
        { _id: user._id },
        { $set: { 'mfa.backupCodes': updatedCodes } }
      )
      if (!(await markSessionMfaVerified(db, session.user.id))) {
        return NextResponse.json({ error: VERIFICATION_FAILED_MESSAGE }, { status: 500 })
      }
      return NextResponse.json({ success: true, usedBackupCode: true })
    }
  }

  return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
}
