import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { IPlannedTransfer } from '@/lib/models/PlannedTransfer'
import type { IAccount } from '@/lib/models/Account'

export async function GET() {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const plannedTransfers = await db
    .collection<IPlannedTransfer>('plannedTransfers')
    .find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .toArray()

  return NextResponse.json(plannedTransfers)
}

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { amount, fromAccountId, toAccountId, cutoffDay } = body

  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!ObjectId.isValid(fromAccountId) || !ObjectId.isValid(toAccountId)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
  }
  if (typeof cutoffDay !== 'number' || !Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) {
    return NextResponse.json({ error: 'cutoffDay must be an integer between 1 and 31' }, { status: 400 })
  }

  const db = await getDb()

  const [fromAccount, toAccount] = await Promise.all([
    db.collection<IAccount>('accounts').findOne({ _id: new ObjectId(fromAccountId), userId: session.user.id }),
    db.collection<IAccount>('accounts').findOne({ _id: new ObjectId(toAccountId), userId: session.user.id }),
  ])
  if (!fromAccount || !toAccount) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const now = new Date()
  const result = await db.collection<IPlannedTransfer>('plannedTransfers').insertOne({
    userId: session.user.id,
    amount,
    fromAccountId,
    toAccountId,
    cutoffDay,
    active: true,
    createdAt: now,
    updatedAt: now,
  } as IPlannedTransfer)

  const plannedTransfer = await db.collection<IPlannedTransfer>('plannedTransfers').findOne({ _id: result.insertedId })
  return NextResponse.json(plannedTransfer, { status: 201 })
}
