/*
 * Goal Projection Utility
 *
 * Problem: Goal progress is visible but users have no forward-looking signal- they
 *          can't tell if they're on track to hit their deadline until it passes.
 *
 * Success criteria: Given a goal's saved/target amounts, deadline, and creation date,
 *                   return a typed projection result that both the API endpoint and the
 *                   milestone email can consume without duplicating math.
 *
 * Scope: Pure function- no DB access, no side effects.
 * Out of scope: AI, notifications, charts.
 */

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44 // average days per month

export type ProjectionStatus = 'on_track' | 'off_track' | 'no_data' | 'completed'

export interface GoalProjectionResult {
  status: ProjectionStatus
  /** Average amount saved per month since goal creation. 0 if no savings yet. */
  avgPerMonth: number
  /** Months needed to reach target at current rate. null when avgPerMonth is 0. */
  monthsToComplete: number | null
  /** Estimated completion date at current rate. null when avgPerMonth is 0. */
  estimatedCompletionDate: Date | null
  /** Months behind deadline. 0 when on track or no data. */
  monthsBehind: number
  /** The goal's deadline, passed through for UI convenience. */
  deadlineDate: Date
}

export interface GoalProjectionInput {
  savedAmount: number
  targetAmount: number
  deadline: Date
  createdAt: Date
}

export function computeGoalProjection(goal: GoalProjectionInput): GoalProjectionResult {
  const now = new Date()
  const deadlineDate = new Date(goal.deadline)

  // Already completed
  if (goal.savedAmount >= goal.targetAmount) {
    return {
      status: 'completed',
      avgPerMonth: 0,
      monthsToComplete: 0,
      estimatedCompletionDate: now,
      monthsBehind: 0,
      deadlineDate,
    }
  }

  // Not enough data- nothing saved yet
  if (goal.savedAmount <= 0) {
    return {
      status: 'no_data',
      avgPerMonth: 0,
      monthsToComplete: null,
      estimatedCompletionDate: null,
      monthsBehind: 0,
      deadlineDate,
    }
  }

  const monthsSinceCreation = Math.max(
    1,
    (now.getTime() - new Date(goal.createdAt).getTime()) / MS_PER_MONTH,
  )

  const avgPerMonth = goal.savedAmount / monthsSinceCreation
  const remaining = goal.targetAmount - goal.savedAmount
  const monthsToComplete = Math.ceil(remaining / avgPerMonth)

  const estimatedCompletionDate = new Date(now.getTime() + monthsToComplete * MS_PER_MONTH)

  const monthsUntilDeadline = (deadlineDate.getTime() - now.getTime()) / MS_PER_MONTH
  const onTrack = monthsToComplete <= monthsUntilDeadline
  const monthsBehind = onTrack ? 0 : Math.ceil(monthsToComplete - monthsUntilDeadline)

  return {
    status: onTrack ? 'on_track' : 'off_track',
    avgPerMonth,
    monthsToComplete,
    estimatedCompletionDate,
    monthsBehind,
    deadlineDate,
  }
}
