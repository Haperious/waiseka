/**
 * Audit: currency consistency across users, accounts and transactions (READ-ONLY)
 *
 * WHY: Phase 0 of the multi-currency PRD (docs/prd/multi-currency.md). Before any
 * write touches currency data we need to know what the existing data looks like:
 * which users hold accounts in more than one currency, which transactions carry a
 * currency that differs from their account's, which have no currency at all, and
 * which users' Settings currency matches none of their accounts (risk R1).
 *
 * WHAT THIS DOES:
 * - Per user, prints: primary (Settings) currency, account currencies, transaction
 *   counts per currency, mismatches against the owning account, missing-currency
 *   counts, and the R1 flag.
 * - Prints a global summary at the end.
 *
 * SAFETY:
 * - READ-ONLY. Uses only find / aggregate / countDocuments. There is no write path
 *   and no --execute flag.
 *
 * RUN:
 *   npx tsx --env-file=.env scripts/audit-currency.ts
 */

import getClient, { getDb } from '../lib/mongodb'
import type { IUser } from '../lib/models/User'
import type { IAccount } from '../lib/models/Account'
import type { ITransaction } from '../lib/models/Transaction'

const NONE = '(none)'

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) {
    const k = key(item)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

function fmtCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts)
  return entries.length === 0 ? '-' : entries.map(([k, v]) => `${k}: ${v}`).join(', ')
}

async function main() {
  const db = await getDb()

  const users = await db
    .collection<IUser>('users')
    .find({}, { projection: { name: 1, email: 1, preferences: 1, 'notifications.lastSeen': 1 } })
    .toArray()
  const accounts = await db.collection<IAccount>('accounts').find({}).toArray()
  const transactions = await db
    .collection<ITransaction & { source?: string }>('transactions')
    .find({}, { projection: { userId: 1, currency: 1, type: 1, accountId: 1, fromAccountId: 1, toAccountId: 1, source: 1, isArchived: 1 } })
    .toArray()
  const budgetCounts = countBy(await db.collection('budgets').find({}, { projection: { userId: 1 } }).toArray(), (b) => String(b.userId))
  const goalCounts = countBy(await db.collection('goals').find({}, { projection: { userId: 1 } }).toArray(), (g) => String(g.userId))

  const accountById = new Map(accounts.map((a) => [a._id.toString(), a]))

  const totals = {
    users: users.length,
    multiCurrencyUsers: 0,
    r1Users: 0,
    transactions: transactions.length,
    mismatched: 0,
    missingCurrency: 0,
    orphanAccountRef: 0,
  }

  for (const user of users) {
    const userId = user._id.toString()
    const primary = user.preferences?.currency ?? NONE
    const userAccounts = accounts.filter((a) => a.userId === userId)
    const activeAccounts = userAccounts.filter((a) => !a.isArchived)
    const activeCurrencies = [...new Set(activeAccounts.map((a) => a.currency ?? NONE))]
    const allAccountCurrencies = [...new Set(userAccounts.map((a) => a.currency ?? NONE))]
    const userTx = transactions.filter((t) => t.userId === userId)

    const isMulti = activeCurrencies.length > 1
    // R1: user has accounts, but none of them are in the Settings currency.
    const isR1 = userAccounts.length > 0 && !allAccountCurrencies.includes(primary)
    if (isMulti) totals.multiCurrencyUsers++
    if (isR1) totals.r1Users++

    // Mismatch: transaction currency differs from the account that owns it.
    // Non-transfers are owned by accountId; transfers by fromAccountId.
    const mismatches: Record<string, number> = {}
    let missing = 0
    let missingImported = 0
    let orphan = 0
    for (const t of userTx) {
      const txCur = t.currency ?? NONE
      if (!t.currency) {
        missing++
        if (t.source === 'import') missingImported++
      }
      const ownerId = t.type === 'transfer' ? t.fromAccountId : t.accountId
      if (!ownerId) continue
      const owner = accountById.get(ownerId.toString())
      if (!owner) {
        orphan++
        continue
      }
      if (owner.currency !== txCur) {
        const key = `account ${owner.currency} / tx ${txCur}`
        mismatches[key] = (mismatches[key] ?? 0) + 1
      }
    }
    const mismatchCount = Object.values(mismatches).reduce((a, b) => a + b, 0)
    totals.mismatched += mismatchCount
    totals.missingCurrency += missing
    totals.orphanAccountRef += orphan

    const flags = [isMulti && 'MULTI-CURRENCY', isR1 && 'R1', mismatchCount > 0 && 'MISMATCHES'].filter(Boolean)

    console.log('─'.repeat(72))
    console.log(`${user.email} (${userId})${flags.length ? '  [' + flags.join(', ') + ']' : ''}`)
    console.log(`  Last seen:              ${user.notifications?.lastSeen ? new Date(user.notifications.lastSeen).toISOString().slice(0, 10) : '-'}`)
    console.log(`  Primary currency:       ${primary}`)
    console.log(`  Accounts (active):      ${fmtCounts(countBy(activeAccounts, (a) => a.currency ?? NONE))}`)
    console.log(`  Accounts (archived):    ${fmtCounts(countBy(userAccounts.filter((a) => a.isArchived), (a) => a.currency ?? NONE))}`)
    for (const a of userAccounts) {
      console.log(`    - ${a.name} [${a.type}] ${a.currency}${a.isArchived ? ' (archived)' : ''}`)
    }
    console.log(`  Transactions:           ${userTx.length}`)
    console.log(`    by currency:          ${fmtCounts(countBy(userTx, (t) => t.currency ?? NONE))}`)
    console.log(`    unassigned (no acct): ${userTx.filter((t) => t.type !== 'transfer' && !t.accountId).length}`)
    console.log(`    missing currency:     ${missing} (imported: ${missingImported})`)
    console.log(`    mismatched vs acct:   ${mismatchCount}${mismatchCount ? '  → ' + fmtCounts(mismatches) : ''}`)
    console.log(`    orphan account ref:   ${orphan}`)
    console.log(`  Budgets: ${budgetCounts[userId] ?? 0}   Goals: ${goalCounts[userId] ?? 0}`)
    console.log(`  Cutoff:                 ${user.preferences?.cutoffMode ?? '(default)'} ${JSON.stringify(user.preferences?.cutoffDays ?? [])}`)
  }

  console.log('═'.repeat(72))
  console.log('SUMMARY')
  console.log(`  Users:                         ${totals.users}`)
  console.log(`  Multi-currency users:          ${totals.multiCurrencyUsers}`)
  console.log(`  R1 users (Settings ≠ accounts): ${totals.r1Users}`)
  console.log(`  Transactions:                  ${totals.transactions}`)
  console.log(`  Mismatched vs owning account:  ${totals.mismatched}`)
  console.log(`  Missing currency:              ${totals.missingCurrency}`)
  console.log(`  Referencing a missing account: ${totals.orphanAccountRef}`)

}

main()
  .catch((err) => {
    console.error('Audit failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    const client = await getClient().catch(() => null)
    await client?.close()
  })
