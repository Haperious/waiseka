import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { verify, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import { ObjectId } from 'mongodb'
import crypto from 'crypto'
import type { IUser } from '@/lib/models/User'

const otpCrypto = new NobleCryptoPlugin()
const otpBase32 = new ScureBase32Plugin()

const BACKUP_CODE_COUNT = 8
const BACKUP_CODE_LENGTH = 8

function generateBackupCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { token } = body

  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: 'Invalid token format. Must be a 6-digit code.' }, { status: 400 })
  }

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { mfa: 1 } })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!user.mfa?.secret) return NextResponse.json({ error: 'MFA setup not initiated. Call /api/auth/mfa/setup first.' }, { status: 400 })
  if (user.mfa.enabled) return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 })

  const verifyResult = await verify({ token, secret: user.mfa.secret, strategy: 'totp', crypto: otpCrypto, base32: otpBase32 })
  if (!verifyResult.valid) {
    return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
  }

  const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode)
  const hashedCodes = plainCodes.map(hashBackupCode)

  await db.collection<IUser>('users').updateOne(
    { _id: user._id },
    {
      $set: {
        'mfa.enabled': true,
        'mfa.backupCodes': hashedCodes,
        'mfa.enabledAt': new Date(),
      },
    }
  )

  return NextResponse.json({
    success: true,
    backupCodes: plainCodes.map((c) => `${c.slice(0, BACKUP_CODE_LENGTH / 2)}-${c.slice(BACKUP_CODE_LENGTH / 2)}`),
  })
}
