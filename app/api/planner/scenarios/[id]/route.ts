import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { badRequest, readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import type { IUser } from '@/lib/models/User'
import type { IPlannerScenario } from '@/lib/models/PlannerScenario'
import { primaryCurrencyOf } from '@/lib/services/currencyScope'
import { buildPlannerContext, resolvePlannerToday } from '@/lib/services/plannerContext'
import { PLANNER_COLLECTION, accountIdsInCurrency, toClientScenario } from '@/lib/services/plannerScenarios'
import { readAccountIds, readEndDate, readItems, readScenarioName } from '@/lib/planner/validate'

/** GET /api/planner/scenarios/:id?today=yyyy-MM-dd - the plan plus the live figures it's projected from. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id

  const db = await getDb()
  const userId = session.user.id
  const [scenario, user] = await Promise.all([
    db.collection<IPlannerScenario>(PLANNER_COLLECTION).findOne({ _id, userId }),
    db.collection<IUser>('users').findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } }),
  ])
  if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const today = resolvePlannerToday(new URL(req.url).searchParams.get('today'))
  const context = await buildPlannerContext(db, userId, primaryCurrencyOf(user), scenario.currency, scenario.endDate, today)
  return NextResponse.json({ scenario: toClientScenario(scenario), context })
}

/**
 * PUT /api/planner/scenarios/:id - save changes. Any of: name, accountIds, endDate, items
 * (the whole list). `today` (the viewer's) is used to check the end date. Accounts that
 * aren't the user's open accounts in the plan's currency are dropped.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  const update: Partial<IPlannerScenario> & { updatedAt: Date } = { updatedAt: new Date() }
  if (body.name !== undefined) {
    const name = readScenarioName(body.name)
    if ('error' in name) return badRequest(name.error)
    update.name = name.value
  }
  if (body.endDate !== undefined) {
    const end = readEndDate(body.endDate, resolvePlannerToday(body.today))
    if ('error' in end) return badRequest(end.error)
    update.endDate = end.value
  }
  if (body.items !== undefined) {
    const items = readItems(body.items)
    if ('error' in items) return badRequest(items.error)
    update.items = items.value
  }
  let requestedAccounts: string[] | undefined
  if (body.accountIds !== undefined) {
    const ids = readAccountIds(body.accountIds)
    if ('error' in ids) return badRequest(ids.error)
    requestedAccounts = ids.value
  }

  const db = await getDb()
  const userId = session.user.id
  const col = db.collection<IPlannerScenario>(PLANNER_COLLECTION)

  if (requestedAccounts) {
    const scenario = await col.findOne({ _id, userId }, { projection: { currency: 1 } })
    if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } })
    const allowed = new Set(await accountIdsInCurrency(db, userId, scenario.currency, primaryCurrencyOf(user)))
    update.accountIds = requestedAccounts.filter((id) => allowed.has(id))
  }

  const saved = await col.findOneAndUpdate({ _id, userId }, { $set: update }, { returnDocument: 'after' })
  if (!saved) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ scenario: toClientScenario(saved) })
}

/** DELETE /api/planner/scenarios/:id */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id

  const db = await getDb()
  const deleted = await db.collection<IPlannerScenario>(PLANNER_COLLECTION).findOneAndDelete({ _id, userId: session.user.id })
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted successfully' })
}
