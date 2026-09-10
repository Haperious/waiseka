import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_HISTORY_DAYS, PREMIUM_HISTORY_DAYS } from '@/lib/constants'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'
import { parseTransactionDate } from '@/lib/utils'
import { checkSpendingAlert } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const category = searchParams.get('category')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const tags = searchParams.get('tags')
  const search = searchParams.get('search')
  const accountId = searchParams.get('accountId')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')

  const db = await getDb()

  // -- Tier gate: clamp history to rolling FREE_HISTORY_DAYS for free users
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) as never })
  const userIsPremium = user ? isPremium(user) : false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { userId: session.user.id }
  if (type) query.type = type
  if (category) query.category = category

  const historyDays = userIsPremium ? PREMIUM_HISTORY_DAYS : FREE_HISTORY_DAYS
  const retentionWindowStart = new Date()
  retentionWindowStart.setUTCDate(retentionWindowStart.getUTCDate() - historyDays)
  retentionWindowStart.setUTCHours(0, 0, 0, 0)

  // Always exclude archived transactions and enforce retention window
  query.isArchived = { $ne: true }
  const callerStart = startDate ? new Date(startDate) : null
  const effectiveStart = callerStart && callerStart > retentionWindowStart ? callerStart : retentionWindowStart
  query.date = { $gte: effectiveStart }
  if (endDate) query.date.$lte = new Date(endDate)

  if (tags) query.tags = { $in: tags.split(',') }
  if (accountId === 'unassigned') {
    query.accountId = null
  } else if (accountId && ObjectId.isValid(accountId)) {
    // Match direct transactions on this account OR either leg of a transfer touching it
    const accountObjectId = new ObjectId(accountId)
    query.$and = [
      ...(query.$and ?? []),
      { $or: [
        { accountId: accountObjectId },
        { fromAccountId: accountObjectId },
        { toAccountId: accountObjectId },
      ] },
    ]
  }
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const searchRegex = { $regex: escapedSearch, $options: 'i' }
    query.$or = [
      { description: searchRegex },
      { category: searchRegex },
    ]
  }

  const col = db.collection<ITransaction>('transactions')
  const [total, transactions] = await Promise.all([
    col.countDocuments(query),
    col.find(query).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
  ])

  return NextResponse.json({ transactions, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { amount, type, category, description, date, tags, isRecurring, currency, accountId } = body

  if (!type || !category || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (accountId !== undefined && accountId !== null && !ObjectId.isValid(accountId)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
  }

  const db = await getDb()

  // Verify the account belongs to this user before linking it - never trust a client-supplied id blindly
  if (accountId) {
    const account = await db.collection('accounts').findOne({ _id: new ObjectId(accountId), userId: session.user.id })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Fetch user once - used both for currency resolution and spending alert below
  const postUser = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(session.user.id) as never },
    { projection: { name: 1, email: 1, preferences: 1 } }
  )
  const resolvedCurrency: ITransaction['currency'] =
    currency ?? postUser?.preferences?.currency ?? 'PHP'

  const now = new Date()
  const result = await db.collection<ITransaction>('transactions').insertOne({
    userId: session.user.id,
    amount,
    currency: resolvedCurrency,
    type,
    category,
    description,
    date: parseTransactionDate(date),
    tags: tags ?? [],
    isRecurring: isRecurring ?? false,
    accountId: accountId ? new ObjectId(accountId) : null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  } as ITransaction)

  const transaction = await db.collection<ITransaction>('transactions').findOne({ _id: result.insertedId })

  if (type === 'expense' && postUser) {
    checkSpendingAlert(session.user.id, category, description ?? category, amount, db, postUser).catch(
      (err) => console.error('[transactions] spending alert error:', err)
    )
  }

  return NextResponse.json(transaction, { status: 201 })
}

