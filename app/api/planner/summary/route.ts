import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'
import type { IPlannerScenario } from '@/lib/models/PlannerScenario'
import { primaryCurrencyOf } from '@/lib/services/currencyScope'
import { buildPlannerContext, resolvePlannerToday } from '@/lib/services/plannerContext'
import { PLANNER_COLLECTION } from '@/lib/services/plannerScenarios'
import { projectScenario } from '@/lib/planner/projection'
import type { PlannerSummary } from '@/lib/planner/types'

/**
 * GET /api/planner/summary?today=yyyy-MM-dd - the dashboard card: the most recently
 * changed plan, projected the same way the Planner page does it. `null` when there's none.
 */
export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const userId = session.user.id
  const [scenario, user] = await Promise.all([
    db.collection<IPlannerScenario>(PLANNER_COLLECTION).find({ userId }).sort({ updatedAt: -1 }).limit(1).next(),
    db.collection<IUser>('users').findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } }),
  ])
  if (!scenario) return NextResponse.json(null)

  const today = resolvePlannerToday(new URL(req.url).searchParams.get('today'))
  const context = await buildPlannerContext(db, userId, primaryCurrencyOf(user), scenario.currency, scenario.endDate, today)
  const p = projectScenario(scenario, context)

  const summary: PlannerSummary = {
    id: scenario._id.toString(),
    name: scenario.name,
    currency: scenario.currency,
    endDate: scenario.endDate,
    start: p.start,
    end: p.end,
    lowest: p.lowest,
    firstNegativeDay: p.firstNegativeDay,
    overdueCount: p.overdueCount,
    expired: p.expired,
  }
  return NextResponse.json(summary)
}
