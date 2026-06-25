import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { INotification } from '@/lib/models/Notification'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const col = db.collection<INotification>('notifications')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const notifications = await col
    .find({ userId: session.user.id, read: false, createdAt: { $gte: thirtyDaysAgo } })
    .sort({ createdAt: -1 })
    .toArray()

  return NextResponse.json(
    notifications.map(n => ({ ...n, _id: n._id.toString() }))
  )
}
