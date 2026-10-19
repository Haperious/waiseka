/*
 * GET /api/summary/range
 *
 * Backs the /reports page (3-month bar chart, month cards, category table) and the
 * dashboard's "Last 3 months" band - both consume the exact same shape.
 *
 * Per product decision, the report range is fixed to the last 3 calendar months for
 * all users (no date-range selector, no premium-extended range for v1), so this route
 * takes no date params - it always resolves "now" and looks back 3 months. The only
 * param is ?currency= (default: primary currency).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { buildRangeReport, monthsBack } from '@/lib/services/monthlyStats'
import { getRequestCurrencyScope } from '@/lib/services/requestCurrency'

const RANGE_MONTHS = 3

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const months = monthsBack(new Date(), RANGE_MONTHS)
  const { scope } = await getRequestCurrencyScope(db, session.user.id, req)
  const report = await buildRangeReport(db, session.user.id, months, scope)

  return NextResponse.json(report)
}
