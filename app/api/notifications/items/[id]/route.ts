import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { INotification } from '@/lib/models/Notification'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const db = await getDb()
  const result = await db.collection<INotification>('notifications').updateOne(
    { _id: new ObjectId(id), userId: session.user.id },
    { $set: { read: true } }
  )

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const db = await getDb()
  const result = await db.collection<INotification>('notifications').deleteOne({
    _id: new ObjectId(id),
    userId: session.user.id,
  })

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
