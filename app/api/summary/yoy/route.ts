/*
 * GET /api/summary/yoy?year=2026&currency=PHP
 *
 * Premium only. Backs the /reports "Year-on-year" range: `year` against the year before,
 * both cut to the same months (Jan through the current month for this year) so the
 * comparison is like for like. Defaults to this year; the earliest allowed year is one
 * after the history window's first, since it needs a previous year (400 otherwise).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { buildYoyReport } from '@/lib/services/yearReport'
import { parseReportYear } from '@/lib/reportYears'
import { getReportViewer, PREMIUM_REPORT_ERROR } from '@/lib/services/reportViewer'

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const { premium, scope } = await getReportViewer(db, session.user.id, req)
  if (!premium) return NextResponse.json({ error: PREMIUM_REPORT_ERROR }, { status: 403 })

  const now = new Date()
  const parsed = parseReportYear(req.nextUrl.searchParams.get('year'), premium, now, 'yoy')
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const report = await buildYoyReport(db, session.user.id, parsed.year, premium, scope, now)
  return NextResponse.json(report)
}
