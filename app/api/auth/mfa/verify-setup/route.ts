import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import crypto from 'crypto'
import type { IUser } from '@/lib/models/User'
import { verifyTotpOnce } from '@/lib/totp'
import { markSessionMfaVerified } from '@/lib/mfa-session'
import { notifyMfaChange } from '@/lib/mfa-notify'

const BACKUP_CODE_COUNT = 8
const BACKUP_CODE_LENGTH = 8

function generateBackupCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { token } = body

  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: 'Invalid token format. Must be a 6-digit code.' }, { status: 400 })
  }

  const db = await getDb()
  const users = db.collection<IUser>('users')
  const user = await users.findOne({ _id: new ObjectId(session.user.id) }, { projection: { mfa: 1, name: 1, email: 1 } })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!user.mfa?.secret) return NextResponse.json({ error: 'MFA setup not initiated. Call /api/auth/mfa/setup first.' }, { status: 400 })
  if (user.mfa.enabled) return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 })

  // Single-use, so the code that confirms setup can't then be replayed at sign-in
  if (!(await verifyTotpOnce(db, user, token))) {
    return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
  }

  const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode)
  const now = new Date()

  // Conditional on still being off, so two confirms at once can't both hand out codes
  const enabled = await users.updateOne(
    { _id: user._id, 'mfa.enabled': false },
    {
      $set: {
        'mfa.enabled': true,
        'mfa.backupCodes': plainCodes.map(hashBackupCode),
        'mfa.enabledAt': now,
        // Every other device is signed out - one signed in before MFA (maybe not the
        // owner's) must now pass it too. This session is re-stamped just below.
        sessionsRevokedAt: now,
        updatedAt: now,
      },
    }
  )
  if (enabled.modifiedCount !== 1) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 })
  }

  // If the re-stamp fails this device was signed out with the rest; the screen still shows
  // the backup codes, then sends the user to sign in again
  let signedOut = false
  try {
    signedOut = !(await markSessionMfaVerified(db, session.user.id))
  } catch (err) {
    console.error('[mfa/verify-setup] session re-stamp failed', err)
    signedOut = true
  }

  notifyMfaChange(db, user, 'enabled', req.headers.get('user-agent'))

  return NextResponse.json({
    success: true,
    signedOut,
    backupCodes: plainCodes.map((c) => `${c.slice(0, BACKUP_CODE_LENGTH / 2)}-${c.slice(BACKUP_CODE_LENGTH / 2)}`),
  })
}
