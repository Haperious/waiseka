import { NextRequest, NextResponse } from 'next/server'
import {
  resetAiQueries,
  sendMonthlyReports,
  sendBudgetReminders,
  sendReEngageEmails,
  sendPushNotifications,
  runAccountAlertsJob,
} from '@/lib/scheduler'

/**
 * POST /api/cron
 *
 * Single dispatch endpoint for all scheduled jobs. A Netlify Scheduled Function
 * (netlify/functions/scheduled-cron.mts) calls this hourly; this route decides which
 * jobs are due based on the current UTC time, mirroring the cron expressions that
 * lib/scheduler.ts uses for local dev.
 *
 * Auth: requires the x-cron-secret header to match CRON_SECRET. The endpoint refuses
 * to run at all if CRON_SECRET is not configured, so it can never be triggered publicly.
 *
 * Manual override: POST { "job": "<name>" } to force-run a single job (for testing).
 * Valid names: reset-ai-queries, monthly-reports, budget-reminders, re-engage,
 * push-notifications, account-alerts.
 */

const JOBS: Record<string, () => Promise<void>> = {
  'reset-ai-queries': resetAiQueries,
  'monthly-reports': sendMonthlyReports,
  'budget-reminders': sendBudgetReminders,
  're-engage': sendReEngageEmails,
  'push-notifications': sendPushNotifications,
  'account-alerts': runAccountAlertsJob,
}

/** Returns the job names due at the given UTC time, matching lib/scheduler.ts schedules. */
function dueJobs(now: Date): string[] {
  const hour = now.getUTCHours()
  const day = now.getUTCDate()
  const due: string[] = []

  if (hour === 0) due.push('reset-ai-queries')       // 0 0 * * *
  if (hour === 8) due.push('account-alerts')          // 0 8 * * *
  if (hour === 9) due.push('push-notifications')      // 0 9 * * *
  if (hour === 10) due.push('re-engage')              // 0 10 * * *
  if (day === 1 && hour === 8) due.push('monthly-reports')   // 0 8 1 * *
  if (day === 15 && hour === 9) due.push('budget-reminders') // 0 9 15 * *

  return due
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional manual override: run one named job regardless of the current time.
  let override: string | undefined
  try {
    const body = await req.json()
    override = typeof body?.job === 'string' ? body.job : undefined
  } catch {
    // no body - scheduled invocation
  }

  const jobNames = override ? [override] : dueJobs(new Date())
  const invalid = jobNames.filter((name) => !JOBS[name])
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Unknown job(s): ${invalid.join(', ')}` }, { status: 400 })
  }

  const ran: string[] = []
  const failed: { job: string; error: string }[] = []
  for (const name of jobNames) {
    try {
      await JOBS[name]()
      ran.push(name)
    } catch (err) {
      failed.push({ job: name, error: err instanceof Error ? err.message : 'unknown error' })
    }
  }

  return NextResponse.json({ ran, failed, at: new Date().toISOString() })
}
