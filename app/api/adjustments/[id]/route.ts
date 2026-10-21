import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import { historyWindowStart, isPremium } from '@/lib/tier'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IAccount } from '@/lib/models/Account'
import type { IUser } from '@/lib/models/User'
import {
  BEFORE_OPENING_DATE_ERROR, accountFigureAsOf, adjustmentDelta, endOfUtcDay, isBeforeOpeningDate,
  readAdjustmentInput, startOfUtcDay,
} from '@/lib/services/balanceAdjustment'

/**
 * PUT /api/adjustments/[id] { targetBalance?, date?, note? }
 *
 * The user edits the balance they entered (not the raw difference); the difference is
 * worked out again against the balance on the (possibly new) date, leaving this
 * adjustment itself out. The account can't change - delete and re-create for that.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const checked = readAdjustmentInput(body, { requireAll: false })
  if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 })
  const input = checked.input

  const db = await getDb()
  const col = db.collection<ITransaction>('transactions')
  const existing = await col.findOne({ _id, userId: session.user.id, type: 'adjustment' })
  if (!existing || !existing.accountId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const account = await db.collection<IAccount>('accounts').findOne({ _id: existing.accountId, userId: session.user.id })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const date = input.date ?? existing.date
  if (input.date) {
    const user = await db.collection<IUser>('users').findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { tier: 1, premiumOverride: 1 } }
    )
    if (date < historyWindowStart(user ? isPremium(user) : false)) {
      return NextResponse.json(
        { error: 'That date is outside your history window. Upgrade to Premium for extended history.' },
        { status: 403 }
      )
    }
  }

  if (isBeforeOpeningDate(account, date)) {
    return NextResponse.json({ error: BEFORE_OPENING_DATE_ERROR }, { status: 400 })
  }
  // One checkpoint per account per day - don't let an edit land on another one's day
  if (input.date) {
    const clash = await col.findOne({
      _id: { $ne: _id },
      userId: session.user.id,
      type: 'adjustment',
      accountId: existing.accountId,
      isArchived: { $ne: true },
      date: { $gte: startOfUtcDay(date), $lte: endOfUtcDay(date) },
    })
    if (clash) {
      return NextResponse.json(
        { error: 'This account already has a balance adjustment on that date. Edit that one instead.' },
        { status: 409 }
      )
    }
  }

  // Older rows always have a target; fall back to "keep the same change" just in case
  const current = await accountFigureAsOf(db, session.user.id, account, date, _id)
  const target = input.targetBalance ?? existing.adjustmentTarget ?? current + (existing.adjustmentDelta ?? 0)
  const delta = adjustmentDelta(current, target)
  if (delta === null) {
    return NextResponse.json(
      { error: 'That balance already matches without this adjustment. Delete the adjustment instead.' },
      { status: 409 }
    )
  }

  const update: Partial<ITransaction> = {
    amount: Math.abs(delta),
    adjustmentDelta: delta,
    adjustmentTarget: target,
    date,
    updatedAt: new Date(),
  }
  if (input.note !== undefined) update.description = input.note

  const adjustment = await col.findOneAndUpdate(
    { _id, userId: session.user.id, type: 'adjustment' },
    { $set: update },
    { returnDocument: 'after' }
  )
  if (!adjustment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ adjustment, previousBalance: current })
}
