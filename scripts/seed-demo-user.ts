/**
 * Create (or delete) a throwaway demo user with sample accounts/categories/transactions/
 * budgets/goals, purely so the dashboard has something realistic-looking to screenshot for
 * marketing/announcement assets - without touching any real user's data.
 *
 * Email is fixed and clearly marked so it's easy to find and remove later.
 *
 * RUN:
 *   Create:  npx tsx scripts/seed-demo-user.ts --execute
 *   Delete:  npx tsx scripts/seed-demo-user.ts --cleanup --execute
 *   (omit --execute on either to dry-run)
 */

import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { getDb } from '../lib/mongodb'
import { CURRENCY_SYMBOL_MAP } from '../lib/models/User'
import { DEFAULT_CATEGORIES, type ICategory } from '../lib/models/Category'
import type { IAccount } from '../lib/models/Account'
import type { ITransaction } from '../lib/models/Transaction'
import type { IBudget } from '../lib/models/Budget'
import type { IGoal } from '../lib/models/Goal'

const DEMO_EMAIL = 'demo-screenshot@waiseka.local'
const DEMO_PASSWORD = 'DemoScreenshot123!'

async function cleanup(execute: boolean) {
  const db = await getDb()
  const user = await db.collection('users').findOne({ email: DEMO_EMAIL })
  if (!user) {
    console.log('No demo user found - nothing to clean up.')
    process.exit(0)
  }
  const userId = user._id.toString()

  console.log(`Found demo user ${userId}. Will delete: user, accounts, categories, transactions, budgets, goals.`)
  if (!execute) {
    console.log('\nDRY RUN - no writes performed. Re-run with --cleanup --execute to delete.')
    process.exit(0)
  }

  await Promise.all([
    db.collection('accounts').deleteMany({ userId }),
    db.collection('categories').deleteMany({ userId }),
    db.collection('transactions').deleteMany({ userId }),
    db.collection('budgets').deleteMany({ userId }),
    db.collection('goals').deleteMany({ userId }),
  ])
  await db.collection('users').deleteOne({ _id: user._id })
  console.log('Demo user and all related data deleted.')
  process.exit(0)
}

async function create(execute: boolean) {
  const db = await getDb()

  const existing = await db.collection('users').findOne({ email: DEMO_EMAIL })
  if (existing) {
    console.log(`Demo user already exists (${existing._id.toString()}). Run with --cleanup first to reset it.`)
    process.exit(0)
  }

  console.log(`Will create demo user "${DEMO_EMAIL}" with sample accounts/categories/transactions/budgets/goals.`)
  if (!execute) {
    console.log('\nDRY RUN - no writes performed. Re-run with --execute to create.')
    process.exit(0)
  }

  const now = new Date()
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12)

  const resetDate = new Date()
  resetDate.setMonth(resetDate.getMonth() + 1)
  resetDate.setDate(1)
  resetDate.setHours(0, 0, 0, 0)

  const userResult = await db.collection('users').insertOne({
    name: 'Demo Account',
    email: DEMO_EMAIL,
    password: hashedPassword,
    avatar: null,
    role: 'user',
    isVerified: true,
    tier: 'premium',
    premiumOverride: true,
    isAdmin: false,
    preferences: { currency: 'PHP', currencySymbol: CURRENCY_SYMBOL_MAP['PHP'] },
    ai: { enabled: true, queriesUsed: 0, queriesCapOverride: null, resetDate, conversations: [] },
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

  const cashId = new ObjectId()
  const creditId = new ObjectId()
  const eWalletId = new ObjectId()

  const accounts: IAccount[] = [
    {
      _id: cashId, userId, name: 'Payroll Debit', type: 'debit', openingBalance: 42000,
      currency: 'PHP', creditLimit: null, dueDay: null, lowBalanceThreshold: null,
      color: '#3b82f6', icon: null, displayOrder: 0, isArchived: false, includeInTotal: true,
      createdAt: now, updatedAt: now,
    },
    {
      _id: creditId, userId, name: 'Rewards Credit Card', type: 'credit', openingBalance: -8500,
      currency: 'PHP', creditLimit: 50000, dueDay: 15, lowBalanceThreshold: null,
      color: '#ef4444', icon: null, displayOrder: 1, isArchived: false, includeInTotal: true,
      createdAt: now, updatedAt: now,
    },
    {
      _id: eWalletId, userId, name: 'E-Wallet', type: 'e_wallet', openingBalance: 3200,
      currency: 'PHP', creditLimit: null, dueDay: null, lowBalanceThreshold: null,
      color: '#22c55e', icon: null, displayOrder: 2, isArchived: false, includeInTotal: true,
      createdAt: now, updatedAt: now,
    },
  ]
  await db.collection<IAccount>('accounts').insertMany(accounts)

  function daysAgo(n: number) {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d
  }

  const transactions: ITransaction[] = [
    { _id: new ObjectId(), userId, amount: 45000, currency: 'PHP', type: 'income', category: 'Salary', description: 'Monthly salary', date: daysAgo(28), tags: [], isRecurring: true, accountId: cashId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 6500, currency: 'PHP', type: 'income', category: 'Freelance', description: 'Freelance project', date: daysAgo(20), tags: [], isRecurring: false, accountId: cashId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 3200, currency: 'PHP', type: 'expense', category: 'Food & Dining', description: 'Groceries', date: daysAgo(25), tags: [], isRecurring: false, accountId: cashId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 1800, currency: 'PHP', type: 'expense', category: 'Transportation', description: 'Gas + tolls', date: daysAgo(22), tags: [], isRecurring: false, accountId: cashId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 12000, currency: 'PHP', type: 'expense', category: 'Housing', description: 'Rent', date: daysAgo(20), tags: [], isRecurring: true, accountId: cashId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 2400, currency: 'PHP', type: 'expense', category: 'Utilities', description: 'Electricity + water', date: daysAgo(18), tags: [], isRecurring: true, accountId: cashId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 1500, currency: 'PHP', type: 'expense', category: 'Entertainment', description: 'Streaming + movies', date: daysAgo(14), tags: [], isRecurring: false, accountId: eWalletId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 2200, currency: 'PHP', type: 'expense', category: 'Shopping', description: 'New shoes', date: daysAgo(10), tags: [], isRecurring: false, accountId: creditId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 900, currency: 'PHP', type: 'expense', category: 'Health & Fitness', description: 'Gym membership', date: daysAgo(9), tags: [], isRecurring: true, accountId: eWalletId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 5000, currency: 'PHP', type: 'savings', category: 'Other', description: 'Monthly savings', date: daysAgo(7), tags: [], isRecurring: true, accountId: cashId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 650, currency: 'PHP', type: 'expense', category: 'Food & Dining', description: 'Dinner out', date: daysAgo(3), tags: [], isRecurring: false, accountId: eWalletId, isArchived: false, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, amount: 1200, currency: 'PHP', type: 'expense', category: 'Transportation', description: 'Ride-hailing', date: daysAgo(1), tags: [], isRecurring: false, accountId: cashId, isArchived: false, createdAt: now, updatedAt: now },
  ]
  await db.collection<ITransaction>('transactions').insertMany(transactions)

  const budgets: IBudget[] = [
    { _id: new ObjectId(), userId, category: 'Food & Dining', limit: 6000, period: 'monthly', spent: 3850, color: '#f97316', createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, category: 'Transportation', limit: 4000, period: 'monthly', spent: 3000, color: '#3b82f6', createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, category: 'Entertainment', limit: 2000, period: 'monthly', spent: 1500, color: '#ec4899', createdAt: now, updatedAt: now },
  ]
  await db.collection<IBudget>('budgets').insertMany(budgets)

  const goals: IGoal[] = [
    { _id: new ObjectId(), userId, title: 'Emergency Fund', targetAmount: 100000, savedAmount: 62000, deadline: daysAgo(-180), priority: 'high', status: 'active', createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId, title: 'New Laptop', targetAmount: 60000, savedAmount: 18000, deadline: daysAgo(-90), priority: 'medium', status: 'active', createdAt: now, updatedAt: now },
  ]
  await db.collection<IGoal>('goals').insertMany(goals)

  console.log(`\nDemo user created: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
  console.log('Remember to run with --cleanup --execute once screenshots are done.')
  process.exit(0)
}

async function main() {
  const isExecute = process.argv.includes('--execute')
  const isCleanup = process.argv.includes('--cleanup')
  if (isCleanup) {
    await cleanup(isExecute)
  } else {
    await create(isExecute)
  }
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
