import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { readJsonBody } from '@/lib/request'
import { confirmPassword } from '@/lib/reauth'
import { generateSecret, generateURI, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import QRCode from 'qrcode'
import { ObjectId } from 'mongodb'
import type { IUser } from '@/lib/models/User'

const otpCrypto = new NobleCryptoPlugin()
const otpBase32 = new ScureBase32Plugin()

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { mfa: 1, email: 1, name: 1, password: 1 } })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.mfa?.enabled) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 })
  }

  // The password, not just the session: otherwise a stolen cookie could turn MFA on with
  // the thief's authenticator and lock the real owner out of their own account
  const reauthError = await confirmPassword(session.user.id, user.password, body.password)
  if (reauthError) return reauthError

  const secret = generateSecret({ crypto: otpCrypto, base32: otpBase32 })
  const otpauthUrl = generateURI({ strategy: 'totp', issuer: 'WaiseKa', label: user.email, secret })
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl)

  await db.collection<IUser>('users').updateOne(
    { _id: user._id },
    { $set: { 'mfa.enabled': false, 'mfa.secret': secret, 'mfa.backupCodes': [] }, $unset: { 'mfa.lastTimeStep': '' } }
  )

  return NextResponse.json({ secret, qrDataUrl, manualEntryKey: secret })
}
