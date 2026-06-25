import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { verify, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import { ObjectId } from 'mongodb'
import crypto from 'crypto'
import type { IUser } from '@/lib/models/User'

// Called mid-login from the MFA step page.
// Expects { userId, token } -- verifies TOTP or backup code.

const otpCrypto = new NobleCryptoPlugin()
const otpBase32 = new ScureBase32Plugin()

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, token } = body

  if (!userId || !token) {
    return NextResponse.json({ error: 'userId and token are required' }, { status: 400 })
  }

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(userId) }, { projection: { mfa: 1 } })

  if (!user || !user.mfa?.enabled) {
    return NextResponse.json({ error: 'MFA not enabled for this user' }, { status: 400 })
  }

  const totpResult = await verify({ token: token.replace(/-/g, ''), secret: user.mfa.secret, strategy: 'totp', crypto: otpCrypto, base32: otpBase32 })
  if (totpResult.valid) {
    return NextResponse.json({ success: true })
  }

  const normalised = token.replace(/-/g, '').toUpperCase()
  const hashed = hashBackupCode(normalised)
  const backupIndex = user.mfa.backupCodes.indexOf(hashed)

  if (backupIndex !== -1) {
    const updatedCodes = [...user.mfa.backupCodes]
    updatedCodes.splice(backupIndex, 1)
    await db.collection<IUser>('users').updateOne(
      { _id: user._id },
      { $set: { 'mfa.backupCodes': updatedCodes } }
    )
    return NextResponse.json({ success: true, usedBackupCode: true })
  }

  return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
}
