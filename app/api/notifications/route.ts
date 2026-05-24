import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { getSettings } from '@/lib/models/GlobalSettings'
import type { IUser } from '@/lib/models/User'

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { notifications: 1 } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    email: user.notifications.email,
    push: {
      enabled: user.notifications.push.enabled,
      frequency: user.notifications.push.frequency,
      fcmToken: user.notifications.push.fcmToken,
    },
    lastSeen: user.notifications.lastSeen,
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getSettings()
  if (!settings.notificationsEnabled) {
    return NextResponse.json({ error: 'Notifications are currently disabled' }, { status: 403 })
  }

  const body = await req.json()
  const { email, push } = body

  if (email?.frequency && !VALID_FREQUENCIES.includes(email.frequency)) {
    return NextResponse.json({ error: 'Invalid frequency value' }, { status: 400 })
  }
  if (push?.frequency && !VALID_FREQUENCIES.includes(push.frequency)) {
    return NextResponse.json({ error: 'Invalid frequency value' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (email?.enabled !== undefined) update['notifications.email.enabled'] = email.enabled
  if (email?.frequency) update['notifications.email.frequency'] = email.frequency
  if (push?.enabled !== undefined) update['notifications.push.enabled'] = push.enabled
  if (push?.frequency) update['notifications.push.frequency'] = push.frequency
  if (push?.fcmToken !== undefined) update['notifications.push.fcmToken'] = push.fcmToken

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOneAndUpdate(
    { _id: new ObjectId(session.user.id) },
    { $set: update },
    { returnDocument: 'after', projection: { notifications: 1 } }
  )

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    email: user.notifications.email,
    push: {
      enabled: user.notifications.push.enabled,
      frequency: user.notifications.push.frequency,
      fcmToken: user.notifications.push.fcmToken,
    },
    lastSeen: user.notifications.lastSeen,
  })
}
