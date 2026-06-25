import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { generateSecret, generateURI, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import QRCode from 'qrcode'
import { ObjectId } from 'mongodb'
import type { IUser } from '@/lib/models/User'

const otpCrypto = new NobleCryptoPlugin()
const otpBase32 = new ScureBase32Plugin()

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { mfa: 1, email: 1, name: 1 } })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.mfa?.enabled) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 })
  }

  const secret = generateSecret({ crypto: otpCrypto, base32: otpBase32 })
  const otpauthUrl = generateURI({ strategy: 'totp', issuer: 'WaiseKa', label: user.email, secret })
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl)

  await db.collection<IUser>('users').updateOne(
    { _id: user._id },
    { $set: { 'mfa.enabled': false, 'mfa.secret': secret, 'mfa.backupCodes': [] } }
  )

  return NextResponse.json({ secret, qrDataUrl, manualEntryKey: secret })
}
