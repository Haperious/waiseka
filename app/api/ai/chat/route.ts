import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { getSettings } from '@/lib/models/GlobalSettings'
import { aiGate, aiQueryCap, withAiQuery } from '@/lib/ai-gate'
import { buildFinancialProfile, buildChatMessages, callAnthropic } from '@/lib/ai'
import type { IUser } from '@/lib/models/User'
import { getUserCurrencies, primaryCurrencyOf } from '@/lib/services/currencyScope'
import { summarizeByCurrency, otherCurrencyBlock, MULTI_CURRENCY_RULE } from '@/lib/services/aiContext'

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { message } = body
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message must be 2,000 characters or fewer' }, { status: 400 })
  }

  const db = await getDb()
  const users = db.collection<IUser>('users')

  const [user, settings] = await Promise.all([
    users.findOne({ _id: new ObjectId(session.user.id) }),
    getSettings(),
  ])
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const gateError = aiGate(user, settings)
  if (gateError) return gateError

  // Multi-currency users get this month's figures per currency, each labelled, so a
  // question like "my PHP spending" is answered from PHP-only numbers. Single-currency
  // users' prompt is unchanged.
  const primary = primaryCurrencyOf(user)
  const userId = user._id.toString()
  const currencies = await getUserCurrencies(db, userId, primary)
  let profileSummary = {}
  let currencyContext: string[] = []
  if (currencies.length > 1) {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const [primarySummary, ...others] = await summarizeByCurrency(db, userId, primary, monthStart)
    profileSummary = {
      totalIncome: primarySummary.income,
      totalExpenses: primarySummary.expenses,
      topCategories: primarySummary.topCategories,
    }
    currencyContext = [...others.map((s) => otherCurrencyBlock(s)), MULTI_CURRENCY_RULE]
  }

  const systemPrompt = [
    buildFinancialProfile(user, profileSummary),
    ...currencyContext,
    "You are a helpful financial assistant. Answer questions based on the user's budget data.",
  ].join('\n\n')

  // Recent history, then the message being asked now
  const messages = [...buildChatMessages(user.ai.conversations), { role: 'user' as const, content: message }]
  const outcome = await withAiQuery(db, user, settings, () => callAnthropic({ systemPrompt, messages }))
  if (outcome instanceof NextResponse) return outcome
  const { result: reply, queriesUsed } = outcome

  const newUserMsg = { role: 'user', content: message, createdAt: new Date() }
  const newAssistantMsg = { role: 'assistant', content: reply, createdAt: new Date() }

  await users.updateOne(
    { _id: user._id },
    {
      $push: {
        'ai.conversations': { $each: [newUserMsg, newAssistantMsg], $slice: -20 },
      } as never,
      $set: { updatedAt: new Date() },
    }
  )

  return NextResponse.json({
    reply,
    queriesUsed,
    queriesRemaining: Math.max(0, aiQueryCap(user, settings) - queriesUsed),
  })
}
