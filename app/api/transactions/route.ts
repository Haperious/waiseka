import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium, historyWindowStart } from '@/lib/tier'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'
import type { IAccount } from '@/lib/models/Account'
import { readPaging, readTransactionFields } from '@/lib/transactionInput'
import { checkSpendingAlert } from '@/lib/notifications'
import { currencyScope, isCurrencyCode, primaryCurrencyOf, resolveTransactionCurrency } from '@/lib/services/currencyScope'
import { resolveDefaultAccount } from '@/lib/services/defaultAccount'
import { getAccountLedger } from '@/lib/services/accountBalance'
import { escapeRegex } from '@/lib/security'

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
  // Optional: only the view-currency switcher sends it. Absent = every currency (as before).
  const currency = searchParams.get('currency')
  const { page, limit } = readPaging(searchParams)

  const db = await getDb()

  // -- Tier gate: clamp history to rolling FREE_HISTORY_DAYS for free users
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) })
  const userIsPremium = user ? isPremium(user) : false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { userId: session.user.id }
  if (type) query.type = type
  if (category) query.category = category

  const retentionWindowStart = historyWindowStart(userIsPremium)

  // Always exclude archived transactions and enforce retention window
  query.isArchived = { $ne: true }
  // Unreadable dates are ignored rather than passed to Mongo as Invalid Date
  const asDate = (raw: string | null) => {
    const d = raw ? new Date(raw) : null
    return d && !Number.isNaN(d.getTime()) ? d : null
  }
  const callerStart = asDate(startDate)
  const callerEnd = asDate(endDate)
  const effectiveStart = callerStart && callerStart > retentionWindowStart ? callerStart : retentionWindowStart
  query.date = { $gte: effectiveStart }
  if (callerEnd) query.date.$lte = callerEnd

  if (tags) query.tags = { $in: tags.split(',') }
  if (accountId === 'unassigned') {
    // Transfers also have no accountId (they use fromAccountId/toAccountId) - they aren't unlinked
    query.accountId = null
    query.$and = [...(query.$and ?? []), { type: { $ne: 'transfer' } }]
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
    const searchRegex = { $regex: escapeRegex(search), $options: 'i' }
    query.$or = [
      { description: searchRegex },
      { category: searchRegex },
    ]
  }

  if (isCurrencyCode(currency)) {
    query.$and = [...(query.$and ?? []), currencyScope(currency, primaryCurrencyOf(user))]
  }

  const col = db.collection<ITransaction>('transactions')
  const [total, transactions] = await Promise.all([
    col.countDocuments(query),
    col.find(query).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
  ])

  // An adjustment's difference depends on the entries before it, which may have changed
  // since it was saved - show the live one, the same figure the balances use
  if (transactions.some((t) => t.type === 'adjustment')) {
    const { adjustmentDeltas } = await getAccountLedger(db, session.user.id)
    for (const t of transactions) {
      const live = t.type === 'adjustment' ? adjustmentDeltas.get(t._id.toString()) : undefined
      if (live === undefined) continue
      t.adjustmentDelta = live
      t.amount = Math.abs(live)
    }
  }

  return NextResponse.json({ transactions, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { amount, isRecurring, accountId } = body

  if (!body.type || !body.category || !body.date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const checked = readTransactionFields(body)
  if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 })
  const { description, tags } = checked.fields
  // Present for sure: the required-fields check above ran first
  const { type, category, date } = checked.fields as Required<Pick<typeof checked.fields, 'type' | 'category' | 'date'>>
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (accountId !== undefined && accountId !== null && !ObjectId.isValid(accountId)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
  }

  const db = await getDb()

  // Fetch user once - used for the default account, currency resolution and spending alert below
  const postUser = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { name: 1, email: 1, preferences: 1, tier: 1, premiumOverride: 1 } }
  )

  // Same rule as the bulk route: nothing older than the plan's history window
  if (date < historyWindowStart(postUser ? isPremium(postUser) : false)) {
    return NextResponse.json(
      { error: 'That date is outside your history window. Upgrade to Premium for extended history.' },
      { status: 403 }
    )
  }

  // Verify the account belongs to this user before linking it - never trust a client-supplied id blindly.
  // Omitted accountId (form submitted before accounts loaded) = default account; explicit null = unassigned.
  let account: IAccount | null = null
  if (accountId) {
    account = await db.collection<IAccount>('accounts').findOne({ _id: new ObjectId(accountId), userId: session.user.id })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  } else if (accountId === undefined) {
    account = await resolveDefaultAccount(db, session.user.id, postUser?.preferences?.defaultAccountId)
  }

  // Currency always comes from the account (or the primary currency when unassigned),
  // never from the client - a PHP account's expense must never be tagged QAR.
  const resolvedCurrency = resolveTransactionCurrency(account, primaryCurrencyOf(postUser))

  const now = new Date()
  const doc = {
    userId: session.user.id,
    amount,
    currency: resolvedCurrency,
    type,
    category,
    description,
    date,
    tags: tags ?? [],
    isRecurring: isRecurring === true,
    accountId: account?._id ?? null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  }
  const result = await db.collection<ITransaction>('transactions').insertOne(doc as ITransaction)
  // The saved document is what we just built - no need to read it back
  const transaction = { _id: result.insertedId, ...doc }

  if (type === 'expense' && postUser) {
    checkSpendingAlert(session.user.id, category, resolvedCurrency, description ?? category, amount, db, postUser).catch(
      (err) => console.error('[transactions] spending alert error:', err)
    )
  }

  return NextResponse.json(transaction, { status: 201 })
}

