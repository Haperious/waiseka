/**
 * Netlify Scheduled Function — the production scheduler for WaiseKa.
 *
 * node-cron (lib/scheduler.ts) does not fire on Netlify's serverless functions because
 * there is no persistent Node process, so all scheduling runs from here instead. This
 * function is a thin shim: Netlify invokes it on a schedule, and it calls the app's
 * secret-guarded /api/cron endpoint, which decides which jobs are due for the current
 * UTC hour and runs them inside the Next.js bundle (where lib/ imports and Nodemailer work).
 *
 * Runs hourly; /api/cron no-ops on hours where nothing is due.
 *
 * Schedule lives in netlify.toml. Requires two site env vars:
 *   - CRON_SECRET: shared secret, also read by /api/cron
 *   - DISABLE_INPROCESS_CRON=true: stops lib/scheduler.ts node-cron from also firing
 *
 * Note: scheduled functions only run on published production deploys, not on
 * deploy previews or branch deploys, and have a 30s execution limit.
 *
 * There is no browser involved in a scheduled-function run - Netlify invokes
 * it directly - so a failure here can't be shown as a page. Instead, on any
 * failure we email the WaiseKa inbox via lib/email.ts so someone finds out.
 */

import { sendCronFailureEmail } from '../../lib/email'

async function alertFailure(reason: string, detail: string) {
  try {
    await sendCronFailureEmail({ reason, detail, occurredAt: new Date().toISOString() })
  } catch (err) {
    console.error('[scheduled-cron] failed to send failure alert email:', err)
  }
}

export default async () => {
  const base = process.env.URL // Netlify sets this to the production site URL
  const secret = process.env.CRON_SECRET

  if (!base || !secret) {
    const detail = 'missing URL or CRON_SECRET env var; skipping'
    console.error(`[scheduled-cron] ${detail}`)
    await alertFailure('Missing configuration', detail)
    return new Response('missing config', { status: 500 })
  }

  try {
    const res = await fetch(`${base}/api/cron`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cron-secret': secret },
      body: '{}',
    })
    const text = await res.text()
    console.log(`[scheduled-cron] /api/cron responded ${res.status}: ${text}`)
    if (!res.ok) {
      await alertFailure(`/api/cron responded ${res.status}`, text)
    }
    return new Response(text, { status: res.ok ? 200 : 502 })
  } catch (err) {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[scheduled-cron] failed to reach /api/cron:', err)
    await alertFailure('Failed to reach /api/cron', detail)
    return new Response('error', { status: 502 })
  }
}
