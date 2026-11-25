import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import crypto from 'crypto'
import type { IUser } from '@/lib/models/User'
import { checkMfaRateLimit } from '@/lib/auth-rate-limit'
import { getClientIp, tooManyRequests } from '@/lib/rate-limit'
import { markSessionMfaVerified } from '@/lib/mfa-session'
import { verifyTotpOnce } from '@/lib/totp'

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

const VERIFICATION_FAILED_MESSAGE = 'Could not complete verification. Please try again.'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitResult = await checkMfaRateLimit(session.user.id, getClientIp(req))
  if (!rateLimitResult.allowed) {
    return tooManyRequests(rateLimitResult, 'Too many attempts. Please wait a few minutes and try again.')
  }

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { token } = body

  // A code is 6 digits and a backup code 8 hex characters (plus a dash) - anything much
  // longer is not a code, so it's refused before any work is done on it
  if (!token || typeof token !== 'string' || token.length > 32) {
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
    if (await verifyTotpOnce(db, user, normalised)) {
      if (!(await markSessionMfaVerified(db, session.user.id))) {
        return NextResponse.json({ error: VERIFICATION_FAILED_MESSAGE }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }
  }

  if (/^[A-Fa-f0-9]{8}$/.test(normalised)) {
    const hashed = hashBackupCode(normalised.toUpperCase())

    // Check and remove the code in one step, so two requests at once can't both use it
    const consumed = await db.collection<IUser>('users').updateOne(
      { _id: user._id, 'mfa.backupCodes': hashed },
      { $pull: { 'mfa.backupCodes': hashed } }
    )

    if (consumed.modifiedCount === 1) {
      if (!(await markSessionMfaVerified(db, session.user.id))) {
        return NextResponse.json({ error: VERIFICATION_FAILED_MESSAGE }, { status: 500 })
      }
      return NextResponse.json({ success: true, usedBackupCode: true })
    }
  }

  return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
}
