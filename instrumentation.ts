export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSchedulers } = await import('./lib/scheduler')
    startSchedulers()

    // Ensure MongoDB indexes exist at startup — not on every request
    const { getDb } = await import('./lib/mongodb')
    const db = await getDb()
    await Promise.all([
      db.collection('notifications').createIndex({ userId: 1 }),
      db.collection('notifications').createIndex({ userId: 1, read: 1 }),
    ])
  }
}
