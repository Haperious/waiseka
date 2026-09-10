/*
 * GET /api/ai/anomalies
 *
 * Problem: Users don't know when a spending category has spiked significantly
 *          compared to their own history. They only notice after the damage is done.
 *
 * Success criteria: Returns flagged categories where current-month spend is >150%
 *                   of the rolling average of prior months. Requires at least 2 prior
 *                   months of data per category before flagging- no false positives
 *                   for new users.
 *
 * Scope: Pure arithmetic aggregation- no AI call, no new models, no tier gate.
 * Out of scope: Push/email notifications, historical anomaly log, per-transaction drill-down.
 */

import { NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { aggregateExpensesByCategoryAndMonth, averageAndDelta, monthMeta, monthsBack } from '@/lib/services/monthlyStats'

const ANOMALY_THRESHOLD = 1.5   // flag when current > avg * 1.5
const MIN_PRIOR_MONTHS  = 2     // minimum prior months needed to establish a baseline
const LOOKBACK_MONTHS   = 3     // how many prior months to average

export interface AnomalyItem {
  category: string
  currentAmount: number
  averageAmount: number
  percentageAbove: number
  monthsOfData: number
}

export interface AnomalyResponse {
  anomalies: AnomalyItem[]
  insufficientData: boolean
}

export async function GET(): Promise<NextResponse<AnomalyResponse>> {
  const session = await requireVerifiedSession()
  if (!session) {
    return NextResponse.json({ anomalies: [], insufficientData: false }, { status: 401 })
  }

  const db = await getDb()
  const now = new Date()

  // ── Build month boundaries ────────────────────────────────────────────────
  const current = monthMeta(now.getUTCFullYear(), now.getUTCMonth() + 1)
  const priorMonths = monthsBack(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), LOOKBACK_MONTHS)
  const priorStart = priorMonths[0].start
  const priorEnd = priorMonths[priorMonths.length - 1].end

  // ── Aggregate current month by category ──────────────────────────────────
  const currentRaw = await aggregateExpensesByCategoryAndMonth(db, session.user.id, current.start, current.end)

  if (currentRaw.length === 0) {
    return NextResponse.json({ anomalies: [], insufficientData: false })
  }

  // ── Aggregate prior months by category + month ────────────────────────────
  const priorRaw = await aggregateExpensesByCategoryAndMonth(db, session.user.id, priorStart, priorEnd)

  // ── Check overall data sufficiency ────────────────────────────────────────
  const allPriorMonths = new Set(priorRaw.map((r) => `${r.year}-${r.month}`))
  if (allPriorMonths.size < MIN_PRIOR_MONTHS) {
    return NextResponse.json({ anomalies: [], insufficientData: true })
  }

  // ── Build per-category prior month map ───────────────────────────────────
  const priorByCategory: Record<string, number[]> = {}
  for (const row of priorRaw) {
    if (!priorByCategory[row.category]) priorByCategory[row.category] = []
    priorByCategory[row.category].push(row.total)
  }

  // ── Detect anomalies ─────────────────────────────────────────────────────
  const anomalies: AnomalyItem[] = []

  for (const { category, total: currentAmount } of currentRaw) {
    const categoryPriorMonths = priorByCategory[category]

    // Skip categories without enough prior history
    if (!categoryPriorMonths || categoryPriorMonths.length < MIN_PRIOR_MONTHS) continue

    const { average: averageAmount, percentageAbove } = averageAndDelta(categoryPriorMonths, currentAmount)

    // Can't compare against a zero baseline
    if (averageAmount <= 0) continue

    if (currentAmount > averageAmount * ANOMALY_THRESHOLD) {
      anomalies.push({
        category,
        currentAmount: Math.round(currentAmount * 100) / 100,
        averageAmount: Math.round(averageAmount * 100) / 100,
        percentageAbove,
        monthsOfData: categoryPriorMonths.length,
      })
    }
  }

  // Sort by most extreme anomaly first
  anomalies.sort((a, b) => b.percentageAbove - a.percentageAbove)

  return NextResponse.json({ anomalies, insufficientData: false })
}
