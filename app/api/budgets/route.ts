import { NextRequest, NextResponse } from 'next/server'
import { badRequest, cleanText, isHexColor, readJsonBody } from '@/lib/request'
import { readAmount } from '@/lib/money'
import { readMonthYear } from '@/lib/queryParams'
import { findDuplicateBudget } from '@/lib/services/budgetSpending'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_BUDGET_LIMIT, PREMIUM_BUDGET_LIMIT } from '@/lib/constants'
import { ObjectId } from 'mongodb'
import type { IBudget } from '@/lib/models/Budget'
import type { IUser } from '@/lib/models/User'
import { INVALID_CURRENCY_MESSAGE, isCurrencyCode, primaryCurrencyOf } from '@/lib/services/currencyScope'
import { getSpentByCurrencyAndCategory } from '@/lib/services/budgetSpending'

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const budgets = await db
    .collection<IBudget>('budgets')
    .find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .toArray()

  if (budgets.length === 0) return NextResponse.json([])

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const { month, year } = readMonthYear(searchParams, now)

  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay())
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)

  // Each budget only counts expenses in its own currency (a budget with no currency is in the primary)
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { preferences: 1 } })
  const primary = primaryCurrencyOf(user)

  const [monthlySpent, weeklySpent] = await Promise.all([
    getSpentByCurrencyAndCategory(db, session.user.id, primary, monthStart, monthEnd),
    getSpentByCurrencyAndCategory(db, session.user.id, primary, weekStart, weekEnd),
  ])

  const budgetsWithSpent = budgets.map((b) => {
    const currency = b.currency ?? primary
    const spentIn = b.period === 'weekly' ? weeklySpent : monthlySpent
    return { ...b, currency, spent: spentIn(currency, b.category) }
  })

  return NextResponse.json(budgetsWithSpent)
}

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { category, limit, period, color, currency } = body

  if (!category || !limit) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const budgetCategory = cleanText(category, 100)
  if (!budgetCategory) return badRequest('category must be 1-100 characters')
  const budgetLimit = readAmount(limit)
  if (budgetLimit === null) return badRequest('limit must be a positive number up to 1,000,000,000,000')
  if (period !== undefined && period !== 'monthly' && period !== 'weekly') return badRequest('period must be monthly or weekly')
  if (color != null && !isHexColor(color)) return badRequest('color must be a hex colour like #3b82f6')
  if (currency !== undefined && !isCurrencyCode(currency)) {
    return NextResponse.json({ error: INVALID_CURRENCY_MESSAGE }, { status: 400 })
  }

  const now = new Date()
  const db = await getDb()

  // -- Tier gate (PRD D6: budgets in every currency share one limit): free users capped at FREE_BUDGET_LIMIT, premium at PREMIUM_BUDGET_LIMIT
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const userIsPremium = isPremium(user)
  const maxBudgets = userIsPremium ? PREMIUM_BUDGET_LIMIT : FREE_BUDGET_LIMIT
  const existingCount = await db.collection<IBudget>('budgets').countDocuments({ userId: session.user.id })
  if (existingCount >= maxBudgets) {
    return NextResponse.json(
      {
        error: userIsPremium
          ? `Premium plan is limited to ${maxBudgets} budgets.`
          : `Free plan is limited to ${maxBudgets} budgets. Upgrade to Premium to add more.`,
      },
      { status: 403 }
    )
  }

  // Two budgets on one category would count the same spending twice
  const budgetPeriod = period ?? 'monthly'
  const budgetCurrency = currency ?? primaryCurrencyOf(user)
  if (await findDuplicateBudget(db, session.user.id, budgetCategory, budgetPeriod, budgetCurrency, primaryCurrencyOf(user))) {
    return NextResponse.json({ error: 'You already have a budget for this category.' }, { status: 409 })
  }

  const result = await db.collection<IBudget>('budgets').insertOne({
    userId: session.user.id,
    category: budgetCategory,
    limit: budgetLimit,
    period: budgetPeriod,
    currency: budgetCurrency,
    spent: 0,
    color,
    createdAt: now,
    updatedAt: now,
  } as IBudget)

  const budget = await db.collection<IBudget>('budgets').findOne({ _id: result.insertedId })
  return NextResponse.json(budget, { status: 201 })
}
