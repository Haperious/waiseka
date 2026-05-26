import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { INotification } from '@/lib/models/Notification'

export async function PATCH() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const result = await db.collection<INotification>('notifications').updateMany(
    { userId: session.user.id, read: false },
    { $set: { read: true } }
  )

  return NextResponse.json({ updated: result.modifiedCount })
}
