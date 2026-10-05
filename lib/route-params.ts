import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'

/**
 * A dynamic route's `[id]` param as an ObjectId, or a ready-to-return 400 when it
 * isn't a valid one (new ObjectId() would otherwise throw a 500). Callers just do:
 *
 *   const _id = await objectIdParam(params)
 *   if (_id instanceof NextResponse) return _id
 */
export async function objectIdParam(params: Promise<{ id: string }>): Promise<ObjectId | NextResponse> {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  return new ObjectId(id)
}
