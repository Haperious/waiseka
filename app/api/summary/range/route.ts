/*
 * GET /api/summary/range
 *
 * Backs the /reports page (3-month bar chart, month cards, category table) and the
 * dashboard's "Last 3 months" band - both consume the exact same shape.
 *
 * Per product decision, the report range is fixed to the last 3 calendar months for
 * all users (no date-range selector, no premium-extended range for v1), so this route
 * takes no query params - it always resolves "now" and looks back 3 months.
 */

import { NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { buildRangeReport, monthsBack } from '@/lib/services/monthlyStats'

const RANGE_MONTHS = 3

export async function GET() {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const months = monthsBack(new Date(), RANGE_MONTHS)
  const report = await buildRangeReport(db, session.user.id, months)

  return NextResponse.json(report)
}
