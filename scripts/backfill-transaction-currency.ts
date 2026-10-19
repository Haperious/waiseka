/**
 * Backfill: stamp every transaction with the currency it belongs to
 *
 * WHY: Phase 1 of the multi-currency PRD (docs/prd/multi-currency.md). Before
 * Phase 1, transactions were tagged with the Settings currency instead of their
 * account's, and imports / an older code path saved no currency at all. Per-currency
 * summaries (Phase 3) need every row to carry the right currency.
 *
 * WHAT THIS DOES:
 * - For each transaction, works out its target currency:
 *     transfer      → currency of fromAccountId
 *     has accountId → currency of accountId
 *     no account    → the user's primary currency (preferences.currency)
 * - Updates only rows whose currency is missing or differs from the target.
 *   Touches no other field.
 * - Logs every change to `currency_backfill_log` as
 *     { runId, transactionId, userId, hadCurrency, oldCurrency, newCurrency, at }
 *   so the run can be reverted exactly (including un-setting a field that was missing).
 *
 * SAFETY:
 * - Defaults to DRY RUN: prints what would change, no writes.
 * - Pass --execute to perform the updates.
 * - Idempotent: a second run finds nothing to change.
 * - --revert <runId> undoes one run (also dry run unless --execute). A row is only
 *   reverted if its currency still equals what the run set, so later edits are kept.
 *
 * RUN:
 *   Dry run:  npx tsx --env-file=.env scripts/backfill-transaction-currency.ts
 *   Execute:  npx tsx --env-file=.env scripts/backfill-transaction-currency.ts --execute
 *   Revert:   npx tsx --env-file=.env scripts/backfill-transaction-currency.ts --revert <runId> [--execute]
 */

import { ObjectId } from 'mongodb'
import getClient, { getDb } from '../lib/mongodb'
import type { IUser } from '../lib/models/User'
import type { IAccount } from '../lib/models/Account'
import type { ITransaction } from '../lib/models/Transaction'
import { primaryCurrencyOf, resolveTransactionCurrency } from '../lib/services/currencyScope'

const LOG_COLLECTION = 'currency_backfill_log'

interface BackfillLogEntry {
  runId: string
  transactionId: ObjectId
  userId: string
  hadCurrency: boolean
  oldCurrency: string | null
  newCurrency: string
  at: Date
  revertedAt?: Date
}

async function backfill(isExecute: boolean) {
  const db = await getDb()

  const users = await db.collection<IUser>('users').find({}, { projection: { email: 1, preferences: 1 } }).toArray()
  const primaryByUser = new Map(users.map((u) => [u._id.toString(), primaryCurrencyOf(u)]))
  const emailByUser = new Map(users.map((u) => [u._id.toString(), u.email]))

  const accounts = await db.collection<IAccount>('accounts').find({}, { projection: { currency: 1 } }).toArray()
  const accountById = new Map(accounts.map((a) => [a._id.toString(), a]))

  const transactions = await db
    .collection<ITransaction>('transactions')
    .find({}, { projection: { userId: 1, currency: 1, type: 1, accountId: 1, fromAccountId: 1 } })
    .toArray()

  const changes: Omit<BackfillLogEntry, 'runId' | 'at'>[] = []
  const skipped = { noUser: 0, orphanAccount: 0 }

  for (const t of transactions) {
    const primary = primaryByUser.get(t.userId)
    if (!primary) {
      skipped.noUser++
      continue
    }
    const ownerId = t.type === 'transfer' ? t.fromAccountId : t.accountId
    const owner = ownerId ? accountById.get(ownerId.toString()) : null
    // Account referenced but gone - don't guess, leave the row for a human to look at
    if (ownerId && !owner) {
      skipped.orphanAccount++
      continue
    }
    const target = resolveTransactionCurrency(owner, primary)
    if (t.currency === target) continue
    changes.push({
      transactionId: t._id,
      userId: t.userId,
      hadCurrency: t.currency !== undefined,
      oldCurrency: t.currency ?? null,
      newCurrency: target,
    })
  }

  // Summary per user / transition
  const byUser = new Map<string, Record<string, number>>()
  for (const c of changes) {
    const counts = byUser.get(c.userId) ?? {}
    const key = `${c.oldCurrency ?? '(none)'} → ${c.newCurrency}`
    counts[key] = (counts[key] ?? 0) + 1
    byUser.set(c.userId, counts)
  }

  console.log(`Transactions scanned:     ${transactions.length}`)
  console.log(`To update:                ${changes.length}`)
  console.log(`Skipped (no user):        ${skipped.noUser}`)
  console.log(`Skipped (orphan account): ${skipped.orphanAccount}`)
  for (const [userId, counts] of byUser) {
    const summary = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ')
    console.log(`  - ${emailByUser.get(userId) ?? userId}: ${summary}`)
  }

  if (changes.length === 0) {
    console.log('Nothing to do.')
    return
  }
  if (!isExecute) {
    console.log('\nDRY RUN - no writes performed. Re-run with --execute to apply.')
    return
  }

  const runId = new Date().toISOString()
  const at = new Date()
  // Log first, so a crash mid-update still leaves a complete revert trail
  await db.collection<BackfillLogEntry>(LOG_COLLECTION).insertMany(changes.map((c) => ({ ...c, runId, at })))
  const result = await db.collection('transactions').bulkWrite(
    changes.map((c) => ({
      updateOne: { filter: { _id: c.transactionId }, update: { $set: { currency: c.newCurrency } } },
    }))
  )
  console.log(`\nUpdated ${result.modifiedCount} transaction(s). runId: ${runId}`)
  console.log(`Revert with: --revert ${runId} --execute`)
}

async function revert(runId: string, isExecute: boolean) {
  const db = await getDb()
  const entries = await db
    .collection<BackfillLogEntry>(LOG_COLLECTION)
    .find({ runId, revertedAt: { $exists: false } })
    .toArray()

  console.log(`Log entries for run ${runId} not yet reverted: ${entries.length}`)
  if (entries.length === 0) return
  if (!isExecute) {
    console.log('DRY RUN - no writes performed. Re-run with --execute to revert.')
    return
  }

  // Only revert rows still holding the value this run set - never clobber later edits
  const result = await db.collection('transactions').bulkWrite(
    entries.map((e) => ({
      updateOne: {
        filter: { _id: e.transactionId, currency: e.newCurrency },
        update: e.hadCurrency ? { $set: { currency: e.oldCurrency } } : { $unset: { currency: '' } },
      },
    }))
  )
  await db.collection<BackfillLogEntry>(LOG_COLLECTION).updateMany(
    { runId, revertedAt: { $exists: false } },
    { $set: { revertedAt: new Date() } }
  )
  console.log(`Reverted ${result.modifiedCount} of ${entries.length} transaction(s).`)
  if (result.modifiedCount < entries.length) {
    console.log('The rest had been edited since the backfill and were left as they are.')
  }
}

async function main() {
  const isExecute = process.argv.includes('--execute')
  const revertIdx = process.argv.indexOf('--revert')
  if (revertIdx !== -1) {
    const runId = process.argv[revertIdx + 1]
    if (!runId || runId.startsWith('--')) throw new Error('--revert needs a runId')
    await revert(runId, isExecute)
  } else {
    await backfill(isExecute)
  }
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    const client = await getClient().catch(() => null)
    await client?.close()
  })
