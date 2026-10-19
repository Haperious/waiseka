/**
 * Backfill: create a default "Cash on Hand" account for existing users with none
 *
 * WHY: Before the Accounts feature shipped, users had no account records at all.
 * The transaction form's account dropdown falls back to the user's oldest debit
 * account, so users with zero accounts get an empty dropdown until they add one
 * manually. This backfill gives every pre-existing user a starting debit account
 * so the dropdown is never empty on their first visit post-launch.
 *
 * WHAT THIS DOES:
 * - Finds all users who have zero documents in the `accounts` collection
 *   (idempotent - running this twice is a no-op for anyone already backfilled,
 *   since after the first run they have at least one account).
 * - For each such user, creates one account:
 *     { name: 'Cash on Hand', type: 'debit', openingBalance: 0,
 *       currency: user.preferences.currency, includeInTotal: true, isArchived: false }
 * - Does NOT touch existing transactions - accountId stays null ("Unassigned")
 *   on any transaction that predates this backfill. Users can reassign manually.
 *
 * SAFETY:
 * - Defaults to DRY RUN: reports how many users/accounts would be affected, no writes.
 * - Pass --execute to actually perform the inserts.
 *
 * RUN:
 *   Dry run (safe, no writes):  npx tsx scripts/backfill-default-accounts.ts
 *   Real run (writes to DB):    npx tsx scripts/backfill-default-accounts.ts --execute
 */

import { getDb } from '../lib/mongodb'
import type { IUser } from '../lib/models/User'
import type { IAccount } from '../lib/models/Account'

async function main() {
  const isExecute = process.argv.includes('--execute')

  const db = await getDb()
  const usersCol = db.collection<IUser>('users')
  const accountsCol = db.collection<IAccount>('accounts')

  // Users who already have at least one account (any state, including archived)
  const userIdsWithAccounts = await accountsCol.distinct('userId')
  const userIdsWithAccountsSet = new Set(userIdsWithAccounts)

  const allUsers = await usersCol
    .find({}, { projection: { name: 1, email: 1, preferences: 1 } })
    .toArray()

  const usersNeedingBackfill = allUsers.filter(
    (u) => !userIdsWithAccountsSet.has(u._id.toString())
  )

  console.log(`Total users: ${allUsers.length}`)
  console.log(`Users with at least one account already: ${userIdsWithAccountsSet.size}`)
  console.log(`Users needing a default account: ${usersNeedingBackfill.length}`)

  if (usersNeedingBackfill.length === 0) {
    console.log('Nothing to do.')
    process.exit(0)
  }

  console.log('\nSample of affected users (first 20):')
  for (const u of usersNeedingBackfill.slice(0, 20)) {
    console.log(`  - ${u.email} (${u._id.toString()}) currency=${u.preferences?.currency ?? 'PHP'}`)
  }

  if (!isExecute) {
    console.log(`\nDRY RUN - no writes performed. ${usersNeedingBackfill.length} account(s) would be created.`)
    console.log('Re-run with --execute to perform the inserts.')
    process.exit(0)
  }

  const now = new Date()
  const docs = usersNeedingBackfill.map((u) => ({
    userId: u._id.toString(),
    name: 'Cash on Hand',
    type: 'debit' as const,
    openingBalance: 0,
    currency: u.preferences?.currency ?? 'PHP',
    creditLimit: null,
    dueDay: null,
    color: null,
    icon: null,
    displayOrder: 0,
    isArchived: false,
    includeInTotal: true,
    createdAt: now,
    updatedAt: now,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await accountsCol.insertMany(docs as any)
  console.log(`\nCreated ${result.insertedCount} default account(s).`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
