import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { ObjectId } from 'mongodb'
import bcrypt from 'bcryptjs'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'
import { newPasswordError } from '@/lib/passwordStrength'

export async function PUT(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { currentPassword, newPassword, confirmPassword } = body

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (typeof currentPassword !== 'string') {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  const passwordError = newPasswordError(newPassword, 'New password')
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 })
  }

  const db = await getDb()
  const users = db.collection<IUser>('users')
  const user = await users.findOne({ _id: new ObjectId(session.user.id) })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const match = await bcrypt.compare(currentPassword, user.password)
  if (!match) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const hashed = await bcrypt.hash(newPassword, 12)
  const now = new Date()
  await users.updateOne(
    { _id: new ObjectId(session.user.id) },
    { $set: { password: hashed, passwordChangedAt: now, updatedAt: now } }
  )

  // The response includes a flag so the client can force a re-login
  return NextResponse.json({ message: 'Password updated successfully', requireReLogin: true })
}
