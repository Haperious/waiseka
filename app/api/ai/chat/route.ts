import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { getSettings } from '@/lib/models/GlobalSettings'
import { aiGate } from '@/lib/ai-gate'
import { buildFinancialProfile, buildChatMessages, callAnthropic } from '@/lib/ai'
import type { IUser } from '@/lib/models/User'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message } = await req.json()
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
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

  const systemPrompt = [
    buildFinancialProfile(user, {}),
    "You are a helpful financial assistant. Answer questions based on the user's budget data.",
  ].join('\n\n')

  const messages = buildChatMessages(user.ai.conversations)
  const reply = await callAnthropic({ systemPrompt, messages })

  const newUserMsg = { role: 'user', content: message, createdAt: new Date() }
  const newAssistantMsg = { role: 'assistant', content: reply, createdAt: new Date() }

  await users.updateOne(
    { _id: user._id },
    {
      $push: {
        'ai.conversations': { $each: [newUserMsg, newAssistantMsg], $slice: -20 },
      } as never,
      $inc: { 'ai.queriesUsed': 1 },
      $set: { updatedAt: new Date() },
    }
  )

  const cap = user.ai.queriesCapOverride ?? settings.aiQueryCap
  return NextResponse.json({
    reply,
    queriesUsed: user.ai.queriesUsed + 1,
    queriesRemaining: Math.max(0, cap - (user.ai.queriesUsed + 1)),
  })
}
