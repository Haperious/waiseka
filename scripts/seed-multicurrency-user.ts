/**
 * Create (or delete) a throwaway multi-currency test user
 *
 * WHY: The multi-currency PRD (docs/prd/multi-currency.md) needs a user whose active
 * accounts span 2+ currencies to check Phase 2+ screens. No real user has one yet,
 * and the owner shouldn't add a PHP account until Phase 3 is live.
 *
 * WHAT THIS CREATES:
 * - User "multicurrency-test@waiseka.local", primary currency QAR, premium, emails off.
 * - Accounts: QAR debit, QAR cash, PHP debit.
 * - Transactions in both currencies, including:
 *     - a QAR and a PHP expense on the same day (mobile day header shows two nets)
 *     - a QAR → QAR transfer
 *     - an unassigned row with no currency (counts as the primary, QAR)
 *
 * SAFETY:
 * - Defaults to DRY RUN. Pass --execute to write.
 * - Refuses to create if the user already exists.
 * - --cleanup --execute deletes the user and everything it owns.
 * - The password is random per run and printed once.
 *
 * RUN:
 *   Create:  npx tsx --env-file=.env scripts/seed-multicurrency-user.ts --execute
 *   Delete:  npx tsx --env-file=.env scripts/seed-multicurrency-user.ts --cleanup --execute
 */

import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import getClient, { getDb } from '../lib/mongodb'
import { CURRENCY_SYMBOL_MAP } from '../lib/models/User'
import { DEFAULT_CATEGORIES, type ICategory } from '../lib/models/Category'
import type { IAccount } from '../lib/models/Account'
import type { ITransaction } from '../lib/models/Transaction'

const TEST_EMAIL = 'multicurrency-test@waiseka.local'
const OWNED_COLLECTIONS = ['accounts', 'categories', 'transactions', 'budgets', 'goals', 'plannedTransfers', 'notifications', 'email_logs']

async function cleanup(execute: boolean) {
  const db = await getDb()
  const user = await db.collection('users').findOne({ email: TEST_EMAIL })
  if (!user) {
    console.log('No test user found - nothing to clean up.')
    return
  }
  const userId = user._id.toString()

  console.log(`Found test user ${userId}. Will delete the user and its ${OWNED_COLLECTIONS.join(', ')}, surveys.`)
  if (!execute) {
    console.log('\nDRY RUN - no writes performed. Re-run with --cleanup --execute to delete.')
    return
  }

  await Promise.all(OWNED_COLLECTIONS.map((c) => db.collection(c).deleteMany({ userId })))
  // Survey responses key userId as an ObjectId, unlike everything else
  await db.collection('surveys').deleteMany({ userId: user._id })
  await db.collection('users').deleteOne({ _id: user._id })
  console.log('Test user and all related data deleted.')
}

async function create(execute: boolean) {
  const db = await getDb()

  const existing = await db.collection('users').findOne({ email: TEST_EMAIL })
  if (existing) {
    console.log(`Test user already exists (${existing._id.toString()}). Run with --cleanup first to reset it.`)
    return
  }

  console.log(`Will create test user "${TEST_EMAIL}" (primary QAR) with QAR + PHP accounts and transactions.`)
  if (!execute) {
    console.log('\nDRY RUN - no writes performed. Re-run with --execute to create.')
    return
  }

  const now = new Date()
  const password = randomBytes(9).toString('base64url')
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const userResult = await db.collection('users').insertOne({
    name: 'Multi-currency Test',
    email: TEST_EMAIL,
    password: await bcrypt.hash(password, 12),
    avatar: null,
    role: 'user',
    isVerified: true,
    tier: 'premium',
    premiumOverride: true,
    isAdmin: false,
    preferences: { currency: 'QAR', currencySymbol: CURRENCY_SYMBOL_MAP['QAR'] },
    ai: { enabled: false, queriesUsed: 0, queriesCapOverride: null, resetDate, conversations: [] },
    // Emails/push off - the scheduler must never mail this fake address
    notifications: {
      email: { enabled: false, frequency: 'weekly' },
      push: { enabled: false, frequency: 'weekly', fcmToken: null },
      lastSeen: now,
    },
    onboarding: { completedAt: now, stepsCompleted: ['accounts', 'dashboard', 'transactions', 'categories', 'goals'], dismissed: true },
    createdAt: now,
    updatedAt: now,
  })
  const userId = userResult.insertedId.toString()

  await db.collection<ICategory>('categories').insertMany(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, userId, createdAt: now, updatedAt: now })) as ICategory[]
  )

  const qarBankId = new ObjectId()
  const qarCashId = new ObjectId()
  const phpBankId = new ObjectId()

  const base = { userId, creditLimit: null, dueDay: null, lowBalanceThreshold: null, icon: null, isArchived: false, includeInTotal: true, createdAt: now, updatedAt: now }
  const accounts: IAccount[] = [
    { ...base, _id: qarBankId, name: 'QNB Payroll', type: 'debit', openingBalance: 8000, currency: 'QAR', color: '#8b1538', displayOrder: 0 },
    { ...base, _id: qarCashId, name: 'QAR Cash', type: 'cash', openingBalance: 500, currency: 'QAR', color: '#a3a3a3', displayOrder: 1 },
    { ...base, _id: phpBankId, name: 'BDO Savings', type: 'debit', openingBalance: 30000, currency: 'PHP', color: '#1d4ed8', displayOrder: 2 },
  ]
  await db.collection<IAccount>('accounts').insertMany(accounts)

  function daysAgo(n: number) {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d
  }
  const tx = (
    amount: number, currency: ITransaction['currency'], type: ITransaction['type'], category: string,
    description: string, days: number, accountId: ObjectId | null,
  ): ITransaction => ({
    _id: new ObjectId(), userId, amount, currency, type, category, description, date: daysAgo(days),
    tags: [], isRecurring: false, accountId, isArchived: false, createdAt: now, updatedAt: now,
  })

  const transactions: ITransaction[] = [
    tx(12000, 'QAR', 'income', 'Salary', 'Monthly salary', 20, qarBankId),
    tx(3500, 'QAR', 'expense', 'Housing', 'Rent', 19, qarBankId),
    tx(420, 'QAR', 'expense', 'Food & Dining', 'Groceries', 6, qarBankId),
    tx(15000, 'PHP', 'income', 'Freelance', 'Freelance project (PH client)', 15, phpBankId),
    tx(2500, 'PHP', 'expense', 'Utilities', 'Family electricity bill', 10, phpBankId),
    // Same day, two currencies - the mobile day header should show two separate nets
    tx(85, 'QAR', 'expense', 'Food & Dining', 'Karak + lunch', 2, qarCashId),
    tx(1200, 'PHP', 'expense', 'Shopping', 'Pasalubong order', 2, phpBankId),
    {
      ...tx(1000, 'QAR', 'transfer', 'Transfer', 'QNB Payroll → QAR Cash', 5, null),
      fromAccountId: qarBankId, toAccountId: qarCashId, countsAsSavings: false,
    },
  ]
  await db.collection<ITransaction>('transactions').insertMany(transactions)

  // Legacy-style row: unassigned and no currency at all - should display in the primary (QAR)
  await db.collection('transactions').insertOne({
    userId, amount: 40, type: 'expense', category: 'Transportation', description: 'Taxi (no currency field)',
    date: daysAgo(1), tags: [], isRecurring: false, accountId: null, isArchived: false, createdAt: now, updatedAt: now,
  })

  console.log(`\nTest user created: ${TEST_EMAIL}`)
  console.log(`Password (shown once): ${password}`)
  console.log('Run with --cleanup --execute when you are done testing.')
}

async function main() {
  const isExecute = process.argv.includes('--execute')
  if (process.argv.includes('--cleanup')) await cleanup(isExecute)
  else await create(isExecute)
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    const client = await getClient().catch(() => null)
    await client?.close()
  })
