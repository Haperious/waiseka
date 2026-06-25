/*
 * GET /api/goals/[id]/projection
 *
 * Problem: Users see goal progress but can't tell if they're on track for the deadline.
 * Success criteria: Returns a typed projection- on_track, off_track, no_data, or completed-
 *                   computed from savedAmount growth rate since goal creation.
 * Scope: Pure math, no AI, no new models.
 * Out of scope: Tier gates (available to all users), notifications.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { IGoal } from '@/lib/models/Goal'
import { computeGoalProjection } from '@/lib/utils/goalProjection'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid goal ID' }, { status: 400 })
  }

  const db = await getDb()
  const goal = await db.collection<IGoal>('goals').findOne({
    _id: new ObjectId(id),
    userId: session.user.id,
  })

  if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only project active goals- paused/completed don't need forward-looking estimates
  if (goal.status !== 'active') {
    return NextResponse.json({
      status: goal.status === 'completed' ? 'completed' : 'no_data',
      avgPerMonth: 0,
      monthsToComplete: null,
      estimatedCompletionDate: null,
      monthsBehind: 0,
      deadlineDate: goal.deadline,
    })
  }

  const result = computeGoalProjection(goal)

  return NextResponse.json({
    status: result.status,
    avgPerMonth: Math.round(result.avgPerMonth * 100) / 100,
    monthsToComplete: result.monthsToComplete,
    estimatedCompletionDate: result.estimatedCompletionDate?.toISOString() ?? null,
    monthsBehind: result.monthsBehind,
    deadlineDate: goal.deadline,
  })
}
