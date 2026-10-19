import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import type { IUser } from '@/lib/models/User'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOneAndUpdate(
    { _id },
    { $set: { 'ai.queriesUsed': 0, updatedAt: new Date() } },
    { returnDocument: 'after', projection: { name: 1, email: 1, 'ai.queriesUsed': 1 } }
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ success: true, message: 'AI queries reset successfully', user })
}
