import type { VoiceKeyword } from '@/hooks/useVoiceKeywords'

export interface ParsedTransaction {
  type?: 'income' | 'expense' | 'savings'
  amount?: number
  category?: string
  description?: string
}

// ─── Trigger words ────────────────────────────────────────────────────────────

const EXPENSE_TRIGGERS = [
  'spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'purchased', 'purchase', 'used',
  'ginastos', 'binayaran', 'nabili', 'inilabas', 'nagbayad', 'nagastos',
  'nag-spend', 'nag-pay', 'nag-buy', 'gastos', 'bayad', 'binili',
]

const INCOME_TRIGGERS = [
  'received', 'receive', 'earned', 'earn', 'got paid', 'collected', 'collect', 'income',
  'natanggap', 'kinita', 'sweldo', 'sahod', 'pumasok', 'nadagdag',
  'naka-receive', 'naka-earn', 'nakakuha', 'nakatanggap', 'kita',
]

// ─── Tagalog number words ─────────────────────────────────────────────────────

const TAGALOG_ONES: Record<string, number> = {
  isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5,
  anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10,
}

// Handles "limang daan" → 500, "dalawang libo" → 2000, "libo" → 1000, "daan" → 100
function parseTagalogNumber(text: string): number | null {
  const lower = text.toLowerCase()

  // Build a combined pattern from known ones words + multipliers
  const onesPattern = Object.keys(TAGALOG_ONES).join('|')
  // e.g. "limang daan", "dalawang libo", bare "daan", bare "libo"
  const tagalogNumRegex = new RegExp(
    `(?:(${onesPattern})(?:ng)?\\s*)?(libo|daan)`,
    'i'
  )

  const match = lower.match(tagalogNumRegex)
  if (!match) {
    // bare ones word: "isa", "dalawa", etc.
    for (const [word, val] of Object.entries(TAGALOG_ONES)) {
      if (lower.includes(word)) return val
    }
    return null
  }

  const onesWord = match[1]?.toLowerCase()
  const multiplier = match[2]?.toLowerCase()
  const onesVal = onesWord ? (TAGALOG_ONES[onesWord] ?? 1) : 1
  const multiplierVal = multiplier === 'libo' ? 1000 : 100

  return onesVal * multiplierVal
}

// ─── Built-in category keyword map ───────────────────────────────────────────
// Keys are lowercase match tokens; values are exact DB category names.

const BUILTIN_KEYWORDS: Array<{ tokens: string[]; category: string }> = [
  { tokens: ['pagkain', 'kain', 'food', 'dining', 'lutuin', 'restaurant', 'kainan'], category: 'Food & Dining' },
  { tokens: ['kuryente', 'electric', 'tubig', 'water', 'utilities', 'bill', 'bayarin'], category: 'Utilities' },
  { tokens: ['pamasahe', 'byahe', 'transport', 'transportation', 'jeep', 'bus', 'taxi', 'grab', 'mrt', 'lrt'], category: 'Transportation' },
  { tokens: ['gamot', 'ospital', 'medicine', 'health', 'fitness', 'doctor', 'hospital', 'konsulta'], category: 'Health & Fitness' },
  { tokens: ['bahay', 'upa', 'rent', 'housing', 'renta', 'apartment'], category: 'Housing' },
  { tokens: ['damit', 'clothes', 'shopping', 'sapatos', 'shoes', 'bag', 'damit', 'mall'], category: 'Shopping' },
  { tokens: ['entertainment', 'libangan', 'sinehan', 'movies', 'cinema', 'laro', 'games'], category: 'Entertainment' },
  { tokens: ['education', 'paaralan', 'tuition', 'school', 'aral', 'libro', 'books'], category: 'Education' },
  { tokens: ['travel', 'biyahe', 'bakasyon', 'vacation', 'hotel'], category: 'Travel' },
  { tokens: ['personal care', 'kagandahan', 'salon', 'gupit', 'haircut', 'spa', 'grooming'], category: 'Personal Care' },
  { tokens: ['gifts', 'gift', 'donation', 'regalo', 'donasyon', 'charity'], category: 'Gifts & Donations' },
  { tokens: ['business', 'negosyo', 'puhunan', 'capital'], category: 'Business' },
  { tokens: ['salary', 'sweldo', 'sahod', 'sueldo'], category: 'Salary' },
  { tokens: ['freelance', 'freelancing', 'project', 'gig'], category: 'Freelance' },
  { tokens: ['investment', 'stocks', 'crypto', 'investing', 'puhunan'], category: 'Investment' },
  { tokens: ['business income', 'kita sa negosyo'], category: 'Business Income' },
  { tokens: ['load', 'data', 'wifi', 'telecoms', 'mobile', 'prepaid', 'globe', 'smart', 'dito'], category: 'Other' },
  { tokens: ['utang', 'loan', 'debt', 'hutang', 'bayad utang'], category: 'Other' },
]

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseSpeechToTransaction(
  transcript: string,
  customKeywords: VoiceKeyword[] = []
): ParsedTransaction {
  const lower = transcript.toLowerCase().trim()
  const result: ParsedTransaction = {}

  // 1. Detect type
  if (INCOME_TRIGGERS.some((t) => lower.includes(t))) {
    result.type = 'income'
  } else if (EXPENSE_TRIGGERS.some((t) => lower.includes(t))) {
    result.type = 'expense'
  }

  // 2. Extract amount - Arabic numerals first
  const numericMatch = lower.match(/[\d,]+(\.\d+)?/)
  if (numericMatch) {
    const cleaned = numericMatch[0].replace(/,/g, '')
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed) && parsed > 0) result.amount = parsed
  } else {
    // Fall back to Tagalog number words
    const tagalogAmt = parseTagalogNumber(lower)
    if (tagalogAmt !== null) result.amount = tagalogAmt
  }

  // 3. Detect category - custom keywords first, then built-ins
  let matched = false

  for (const { keyword, category } of customKeywords) {
    if (lower.includes(keyword.toLowerCase())) {
      result.category = category
      matched = true
      break
    }
  }

  if (!matched) {
    for (const { tokens, category } of BUILTIN_KEYWORDS) {
      if (tokens.some((t) => lower.includes(t))) {
        result.category = category
        break
      }
    }
  }

  // 4. Description - use the original transcript trimmed
  result.description = transcript.trim()

  return result
}
