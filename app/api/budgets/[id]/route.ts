import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import Budget from '@/lib/models/Budget'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  await connectDB()
  const budget = await Budget.findOneAndUpdate(
    { _id: id, userId: session.user.id },
    body,
    { new: true }
  )

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(budget)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await connectDB()
  const budget = await Budget.findOneAndDelete({ _id: id, userId: session.user.id })

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted successfully' })
}
