import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import type { IAccount } from '@/lib/models/Account'
import { accountFigureAsOf, readAdjustmentInput } from '@/lib/services/balanceAdjustment'
import { recordVerification } from '@/lib/services/verification'

/**
 * POST /api/accounts/[id]/verify { date: yyyy-MM-dd, balance }
 *
 * "Yes, my bank shows the same." `balance` is the figure the user was shown for `date`
 * (balance, or amount owed for cards). The server works it out again and refuses if it
 * moved in the meantime, so a stale screen can't mark a wrong balance as checked.
 * When it doesn't match, the user adjusts instead (POST /api/adjustments), which also
 * counts as a check.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  // Same checks as an adjustment's balance and date
  const checked = readAdjustmentInput({ targetBalance: body.balance, date: body.date }, { requireAll: true })
  if ('error' in checked) {
    return NextResponse.json({ error: checked.error.replace('targetBalance', 'balance') }, { status: 400 })
  }
  const { targetBalance: balance, date } = checked.input as { targetBalance: number; date: Date }
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "date can't be in the future" }, { status: 400 })
  }

  const db = await getDb()
  const account = await db.collection<IAccount>('accounts').findOne({ _id, userId: session.user.id })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (account.isArchived) {
    return NextResponse.json({ error: 'Cannot check an archived account' }, { status: 409 })
  }

  const current = await accountFigureAsOf(db, session.user.id, account, date)
  if (Math.abs(current - balance) >= 0.005) {
    return NextResponse.json(
      { error: 'The balance changed since you looked. Check it again.', balance: current },
      { status: 409 }
    )
  }

  await recordVerification(db, session.user.id, account._id, date, current)
  return NextResponse.json({ verified: true, balance: current })
}
