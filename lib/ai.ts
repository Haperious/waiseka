import Anthropic from '@anthropic-ai/sdk'
import type { IUser, IConversationMessage } from '@/lib/models/User'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RecentSummary {
  totalIncome?: number
  totalExpenses?: number
  topCategories?: { category: string; amount: number }[]
  savingsRate?: number
  activeGoals?: { title: string; targetAmount: number; savedAmount: number }[]
}

export function buildFinancialProfile(user: IUser, recentSummary: RecentSummary): string {
  const currency = user.preferences.currency
  const symbol = user.preferences.currencySymbol
  const income = recentSummary.totalIncome ?? 0
  const expenses = recentSummary.totalExpenses ?? 0
  const savingsRate = recentSummary.savingsRate ?? (income > 0 ? ((income - expenses) / income) * 100 : 0)

  const topCats = (recentSummary.topCategories ?? [])
    .slice(0, 5)
    .map((c) => `${c.category} (${symbol}${c.amount.toFixed(2)})`)
    .join(', ')

  const goals = (recentSummary.activeGoals ?? [])
    .map((g) => `${g.title}: ${symbol}${g.savedAmount} / ${symbol}${g.targetAmount}`)
    .join('; ')

  return [
    `Currency: ${currency} (${symbol})`,
    `Monthly income range: ~${symbol}${income.toFixed(2)}`,
    `Monthly expenses: ~${symbol}${expenses.toFixed(2)}`,
    `Savings rate: ${savingsRate.toFixed(1)}%`,
    topCats ? `Top spending categories: ${topCats}` : '',
    goals ? `Active goals: ${goals}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildChatMessages(
  conversations: IConversationMessage[]
): { role: 'user' | 'assistant'; content: string }[] {
  return conversations.slice(-10).map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }))
}

export async function callAnthropic({
  systemPrompt,
  messages,
  maxTokens = 1000,
}: {
  systemPrompt: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
}): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Anthropic')
  return block.text
}
