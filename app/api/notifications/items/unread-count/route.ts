import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { INotification } from '@/lib/models/Notification'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const count = await db
    .collection<INotification>('notifications')
    .countDocuments({ userId: session.user.id, read: false })

  return NextResponse.json({ count })
}
