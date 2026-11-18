import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { badRequest, readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_PLANNER_SCENARIO_LIMIT, PREMIUM_PLANNER_SCENARIO_LIMIT } from '@/lib/constants'
import type { IUser } from '@/lib/models/User'
import type { IPlannerScenario } from '@/lib/models/PlannerScenario'
import { INVALID_CURRENCY_MESSAGE, isCurrencyCode, primaryCurrencyOf } from '@/lib/services/currencyScope'
import { resolvePlannerToday } from '@/lib/services/plannerContext'
import {
  PLANNER_COLLECTION, accountIdsInCurrency, carryForward, duplicateName, toClientScenario,
} from '@/lib/services/plannerScenarios'
import { monthEnd } from '@/lib/planner/days'
import { readScenarioName } from '@/lib/planner/validate'
import type { PlannerListResponse, PlannerScenarioListItem } from '@/lib/planner/types'

/** GET /api/planner/scenarios - the user's saved plans, most recently changed first. */
export async function GET() {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const [rows, user] = await Promise.all([
    db.collection<IPlannerScenario>(PLANNER_COLLECTION).aggregate<PlannerScenarioListItem & { _id: ObjectId; updatedAt: Date }>([
      { $match: { userId: session.user.id } },
      { $sort: { updatedAt: -1 } },
      { $limit: PREMIUM_PLANNER_SCENARIO_LIMIT },
      { $project: { name: 1, currency: 1, endDate: 1, updatedAt: 1, itemCount: { $size: { $ifNull: ['$items', []] } } } },
    ]).toArray(),
    db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) }, { projection: { tier: 1, premiumOverride: 1 } }),
  ])

  const body: PlannerListResponse = {
    scenarios: rows.map((r) => ({ ...r, _id: r._id.toString(), updatedAt: new Date(r.updatedAt).toISOString() })),
    limit: user && isPremium(user) ? null : FREE_PLANNER_SCENARIO_LIMIT,
  }
  return NextResponse.json(body)
}

/**
 * POST /api/planner/scenarios - a new plan. Body is one of:
 *   { name, currency }        a blank plan starting from the accounts that count toward total money
 *   { duplicateOf: id }       an exact copy
 *   { carryFrom: id }         a copy moved to the next month
 * `today` (yyyy-MM-dd, the viewer's) is optional.
 */
export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const today = resolvePlannerToday(body.today)

  const sourceId = body.duplicateOf ?? body.carryFrom
  if (sourceId !== undefined && (typeof sourceId !== 'string' || !ObjectId.isValid(sourceId) || sourceId.length !== 24)) {
    return badRequest('Invalid scenario id')
  }

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(userId) }, { projection: { tier: 1, premiumOverride: 1, preferences: 1 } },
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const col = db.collection<IPlannerScenario>(PLANNER_COLLECTION)
  const premium = isPremium(user)
  const limit = premium ? PREMIUM_PLANNER_SCENARIO_LIMIT : FREE_PLANNER_SCENARIO_LIMIT
  if (await col.countDocuments({ userId }) >= limit) {
    return NextResponse.json(
      {
        error: premium
          ? `You can save up to ${limit} plans. Delete one to make room.`
          : `Free plan is limited to ${limit} saved plans. Delete one or upgrade to Premium for more.`,
        code: 'limit',
      },
      { status: 403 },
    )
  }

  const now = new Date()
  let doc: Omit<IPlannerScenario, '_id'>

  if (sourceId) {
    // Owner check is part of the query - another user's id simply isn't found
    const source = await col.findOne({ _id: new ObjectId(sourceId as string), userId })
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const moved = body.carryFrom !== undefined
      ? carryForward(source, today)
      : { name: duplicateName(source.name), endDate: source.endDate, items: source.items }
    doc = {
      userId,
      name: moved.name,
      currency: source.currency,
      accountIds: source.accountIds,
      endDate: moved.endDate,
      items: moved.items,
      createdAt: now,
      updatedAt: now,
    }
  } else {
    const name = readScenarioName(body.name)
    if ('error' in name) return badRequest(name.error)
    const primary = primaryCurrencyOf(user)
    const currency = body.currency ?? primary
    if (!isCurrencyCode(currency)) return badRequest(INVALID_CURRENCY_MESSAGE)
    doc = {
      userId,
      name: name.value,
      currency,
      // Same starting set as the Total Money card
      accountIds: await accountIdsInCurrency(db, userId, currency, primary, { totalMoneyOnly: true }),
      endDate: monthEnd(today),
      items: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  const result = await col.insertOne(doc as IPlannerScenario)
  return NextResponse.json(toClientScenario({ ...doc, _id: result.insertedId } as IPlannerScenario), { status: 201 })
}
