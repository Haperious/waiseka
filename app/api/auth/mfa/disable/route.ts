import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { verifySync, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import { ObjectId } from 'mongodb'
import type { IUser } from '@/lib/models/User'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
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

  const isValid = verifySync({ token, secret: user.mfa.secret, strategy: 'totp', crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() })
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
  }

  await db.collection<IUser>('users').updateOne(
    { _id: user._id },
    { $unset: { mfa: '' } }
  )

  return NextResponse.json({ success: true })
}
