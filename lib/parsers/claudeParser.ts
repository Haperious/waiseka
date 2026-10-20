import type { ITransaction } from '@/lib/models/Transaction'
import { askClaude } from '@/lib/ai'

const EXTRACTION_PROMPT = `Extract all transactions from this bank statement or screenshot.
Return ONLY a valid JSON array. No explanation, no markdown, no extra text.
Format:
[
  {
    "date": "YYYY-MM-DD",
    "description": "merchant or transaction name",
    "amount": 0.00,
    "type": "income" | "expense" | "savings",
    "category": "inferred category"
  }
]
Rules:
- amount must always be a positive number
- type must be one of: income, expense, savings
- category should be inferred from description (e.g. Food & Dining, Transport, Shopping, Bills & Utilities, Salary, Savings, Transfer)
- date must be in YYYY-MM-DD format
- Skip transfers between own accounts if obvious`

export async function extractWithClaude(
  fileBuffer: Buffer,
  mediaType: string
): Promise<Partial<ITransaction>[]> {
  const base64 = fileBuffer.toString('base64')

  const isPDF = mediaType === 'application/pdf'

  const fileContent = isPDF
    ? ({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      } as const)
    : ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: base64,
        },
      } as const)

  // A long statement's JSON runs to thousands of tokens on top of the model's thinking;
  // the old 2000 cut it off mid-array, which then parsed as "no transactions found"
  const { text, truncated } = await askClaude({
    messages: [{ role: 'user', content: [fileContent, { type: 'text', text: EXTRACTION_PROMPT }] }],
    effort: 'medium',
    maxTokens: 32000,
  })
  if (truncated) throw new Error('Statement too long to extract in one pass')

  // Tolerate a fenced ```json block despite the prompt asking for bare JSON
  const json = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  if (!json) return []
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('Extraction did not return a JSON array')
  return parsed
}
