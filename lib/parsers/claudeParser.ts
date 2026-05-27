import Anthropic from '@anthropic-ai/sdk'
import type { ITransaction } from '@/lib/models/Transaction'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [fileContent, { type: 'text', text: EXTRACTION_PROMPT }],
      },
    ],
  })

  const text =
    response.content.find((c) => c.type === 'text')?.text ?? '[]'

  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}
