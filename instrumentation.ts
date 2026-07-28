export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startSchedulers } = await import('./lib/scheduler')
      startSchedulers()

      // Ensure MongoDB indexes exist at startup — not on every request
      const { getDb } = await import('./lib/mongodb')
      const db = await getDb()
      await Promise.all([
        db.collection('notifications').createIndex({ userId: 1 }),
        db.collection('notifications').createIndex({ userId: 1, read: 1 }),
        // Announcements: do NOT add a TTL index here - expired announcements must persist
        // for analytics (announcementViews joins back to them). Expiry is a query filter,
        // not a deletion. See PRD-announcement-popup-2026-07.md §3.1.
        db.collection('announcements').createIndex({ key: 1 }, { unique: true }),
        db.collection('announcements').createIndex({ isActive: 1, publishedAt: -1, expiresAt: 1 }),
        db.collection('announcementViews').createIndex(
          { userId: 1, announcementKey: 1 },
          { unique: true }
        ),
        db.collection('announcementViews').createIndex({ announcementKey: 1, seenAt: -1 }),
      ])
    } catch (error) {
      // A MongoDB blip here (timeout, replica set election) must not crash the
      // whole function — instrumentation runs at startup, outside any request,
      // so an unhandled rejection here takes down the entire invocation.
      console.error('[instrumentation] register() failed, continuing without indexes/schedulers:', error)
    }
  }
}
