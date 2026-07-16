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
 */

export default async () => {
  const base = process.env.URL // Netlify sets this to the production site URL
  const secret = process.env.CRON_SECRET

  if (!base || !secret) {
    console.error('[scheduled-cron] missing URL or CRON_SECRET env var; skipping')
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
    return new Response(text, { status: res.ok ? 200 : 502 })
  } catch (err) {
    console.error('[scheduled-cron] failed to reach /api/cron:', err)
    return new Response('error', { status: 502 })
  }
}
