// Next.js waits for register() before serving the first request after a cold start,
// so nothing slow may be awaited here.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // On Netlify cron runs as a scheduled function, so skip loading the scheduler
  // (and the email/notification code it pulls in) entirely
  if (process.env.DISABLE_INPROCESS_CRON !== "true") {
    const { startSchedulers } = await import("./lib/scheduler")
    startSchedulers()
  }

  // Runs in the background: it also opens the MongoDB connection early, so the
  // first request finds it ready instead of waiting on a blocking startup step
  void (async () => {
    const [{ getDb }, { ensureIndexes }] = await Promise.all([
      import("./lib/mongodb"),
      import("./lib/indexes"),
    ])
    await ensureIndexes(await getDb())
  })().catch((err) => console.error("[startup] index setup failed:", err))
}
