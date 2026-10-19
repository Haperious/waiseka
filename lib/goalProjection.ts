import { countCutoffsBetween, type CutoffPreferences } from '@/lib/services/cutoff'

/** Round up to the next ₱50 so the per-cutoff amount is easy to set aside. */
export const GOAL_ROUND_TO = 50

/** A goal deadline input (yyyy-MM-dd) as the end of that local day, so the goal is due through the whole day. */
export function goalDeadlineToIso(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59`).toISOString()
}

/** A goal deadline input (yyyy-MM-dd) as the start of that local day, or null if empty or invalid. */
export function parseGoalDeadline(dateInput: string): Date | null {
  if (!dateInput) return null
  const date = new Date(`${dateInput}T00:00:00`)
  return isNaN(date.getTime()) ? null : date
}

/**
 * How much to set aside each payday to hit the target by the deadline, under the
 * user's cutoff schedule. Null when there's nothing to project (no amount or date,
 * target already reached, or no payday left before the deadline).
 */
export function projectGoal(
  target: number,
  current: number,
  deadline: Date | null,
  prefs: CutoffPreferences,
  now = new Date(),
): { cutoffs: number; perCutoff: number } | null {
  const remaining = target - current
  if (!deadline || target <= 0 || remaining <= 0) return null
  const cutoffs = countCutoffsBetween(prefs, now, deadline)
  if (cutoffs <= 0) return null
  return { cutoffs, perCutoff: Math.ceil(remaining / cutoffs / GOAL_ROUND_TO) * GOAL_ROUND_TO }
}
