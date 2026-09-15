import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireAdminSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await params

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { 'ai.queriesUsed': 0, updatedAt: new Date() } },
    { returnDocument: 'after', projection: { name: 1, email: 1, 'ai.queriesUsed': 1 } }
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ success: true, message: 'AI queries reset successfully', user })
}
