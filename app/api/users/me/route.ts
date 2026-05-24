import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'

const EXCLUDE = { password: 0, __v: 0, 'ai.conversations': 0 }

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: EXCLUDE })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(user)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, avatar } = body

  const db = await getDb()
  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (name) update.name = name
  if (avatar !== undefined) update.avatar = avatar

  const user = await db
    .collection<IUser>('users')
    .findOneAndUpdate(
      { _id: new ObjectId(session.user.id) },
      { $set: update },
      { returnDocument: 'after', projection: EXCLUDE }
    )

  return NextResponse.json(user)
}
