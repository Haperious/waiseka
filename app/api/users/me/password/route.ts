import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import bcrypt from 'bcryptjs'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { currentPassword, newPassword, confirmPassword } = body

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
  }

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
  await users.updateOne(
    { _id: new ObjectId(session.user.id) },
    { $set: { password: hashed, updatedAt: new Date() } }
  )

  return NextResponse.json({ message: 'Password updated successfully' })
}
