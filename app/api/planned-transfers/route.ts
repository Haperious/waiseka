import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { readAmount } from '@/lib/money'
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

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { fromAccountId, toAccountId, cutoffDay } = body

  const amount = readAmount(body.amount)
  if (amount === null) {
    return NextResponse.json({ error: 'amount must be a positive number up to 1,000,000,000,000' }, { status: 400 })
  }
  if (typeof fromAccountId !== 'string' || typeof toAccountId !== 'string'
    || !ObjectId.isValid(fromAccountId) || !ObjectId.isValid(toAccountId)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
  }
  if (new ObjectId(fromAccountId).equals(new ObjectId(toAccountId))) {
    return NextResponse.json({ error: 'Cannot plan a transfer to the same account' }, { status: 400 })
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
  // Same rules as recording the transfer itself
  if (fromAccount.isArchived || toAccount.isArchived) {
    return NextResponse.json({ error: 'Cannot plan a transfer to or from an archived account' }, { status: 409 })
  }
  if (fromAccount.currency !== toAccount.currency) {
    return NextResponse.json({ error: 'Both accounts must use the same currency.' }, { status: 409 })
  }

  const now = new Date()
  const result = await db.collection<IPlannedTransfer>('plannedTransfers').insertOne({
    userId: session.user.id,
    amount,
    // Stored as the canonical hex, so lookups by account id always match
    fromAccountId: fromAccount._id.toHexString(),
    toAccountId: toAccount._id.toHexString(),
    cutoffDay,
    active: true,
    createdAt: now,
    updatedAt: now,
  } as IPlannedTransfer)

  const plannedTransfer = await db.collection<IPlannedTransfer>('plannedTransfers').findOne({ _id: result.insertedId })
  return NextResponse.json(plannedTransfer, { status: 201 })
}
