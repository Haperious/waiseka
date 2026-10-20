import Anthropic from '@anthropic-ai/sdk'
import type { IUser, IConversationMessage } from '@/lib/models/User'
import { ANTHROPIC_MODEL } from '@/lib/constants'
import { getCurrencySymbol, type CurrencyCode } from '@/lib/currency'
import { primaryCurrencyOf } from '@/lib/services/currencyScope'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RecentSummary {
  totalIncome?: number
  totalExpenses?: number
  topCategories?: { category: string; amount: number }[]
  savingsRate?: number
  activeGoals?: { title: string; targetAmount: number; savedAmount: number }[]
}

/**
 * `currency` overrides the currency the figures are in (default: the user's primary),
 * e.g. for a goal kept in a non-primary currency.
 */
export function buildFinancialProfile(user: IUser, recentSummary: RecentSummary, currency?: CurrencyCode): string {
  const code = currency ?? primaryCurrencyOf(user)
  const symbol = getCurrencySymbol(code)
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
    `Currency: ${code} (${symbol})`,
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

/** Claude declined the request (stop_reason "refusal"), even after server-side fallback. */
export class ClaudeRefusalError extends Error {}

/**
 * One request to Claude; returns the reply text and whether max_tokens cut it off.
 *
 * Sonnet 5.5 thinks before answering (adaptive thinking is on by default), so a response
 * can start with `thinking` blocks - the text is read by block type, never content[0] - and
 * max_tokens has to cover the thinking as well as the reply. `effort` sets how much it
 * thinks. `fallbacks: 'default'` has the API retry a safety decline on a fallback model
 * inside the same call; a decline that survives that throws ClaudeRefusalError.
 */
export async function askClaude({
  system,
  messages,
  effort,
  maxTokens = 16000,
}: {
  system?: string
  messages: Anthropic.Beta.BetaMessageParam[]
  effort: 'low' | 'medium' | 'high'
  maxTokens?: number
}): Promise<{ text: string; truncated: boolean }> {
  // Streamed and collected with finalMessage(): the SDK refuses non-streaming requests whose
  // max_tokens could run past 10 minutes (above ~21K), which the statement parser needs
  const response = await client.beta.messages.stream({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort },
    ...(system && { system }),
    messages,
  }).finalMessage()

  if (response.stop_reason === 'refusal') {
    throw new ClaudeRefusalError(`Claude declined the request (${response.stop_details?.category ?? 'no category'})`)
  }
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
  return { text, truncated: response.stop_reason === 'max_tokens' }
}

/** Chat-style text reply for the AI features (chat, report, recommendations, goal check). */
export async function callAnthropic({
  systemPrompt,
  messages,
}: {
  systemPrompt: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}): Promise<string> {
  // Short advice from a small summary: low effort is the recommended level for chat
  const { text } = await askClaude({ system: systemPrompt, messages, effort: 'low' })
  if (!text) throw new Error('Claude returned no text')
  return text
}
