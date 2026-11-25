import { after } from 'next/server'

/**
 * Run `task` once the response has been sent, without holding the response for it.
 *
 * A bare un-awaited promise isn't enough on serverless hosts: Netlify can freeze the
 * function as soon as the response is out, so an email still being sent may never go.
 * `after()` keeps the function alive until the task settles. Outside a request (scripts,
 * unit tests) `after()` throws, and the task simply runs in the background instead.
 * Errors are logged with `label` and never reach the caller.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): void {
  const run = () => task().catch((err) => console.error(`[${label}]`, err))
  try {
    after(run)
  } catch {
    void run()
  }
}
