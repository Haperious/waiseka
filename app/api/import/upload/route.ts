import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { getMonthlyImportCount } from '@/lib/importUsage'
import { extractFromPDF } from '@/lib/parsers/pdfParser'
import { extractTextWithTextract } from '@/lib/parsers/textractParser'
import { extractWithClaude } from '@/lib/parsers/claudeParser'
import { parseTransactionsFromText } from '@/lib/parsers/transactionParser'
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'

const FREE_IMPORT_LIMIT = 5

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const db = await getDb()
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const premium = isPremium({ tier: user.tier, premiumOverride: user.premiumOverride })

  if (!premium) {
    const count = await getMonthlyImportCount(userId)
    if (count >= FREE_IMPORT_LIMIT) {
      return NextResponse.json({ error: 'IMPORT_LIMIT_REACHED' }, { status: 429 })
    }
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const fileType = (formData.get('fileType') as string | null) ?? ''
  const pdfPassword = (formData.get('pdfPassword') as string | null) ?? undefined

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const isPDF = fileType === 'application/pdf'
  const isImage = ['image/jpeg', 'image/png', 'image/jpg'].includes(fileType)

  if (!isPDF && !isImage) {
    return NextResponse.json({ error: 'UNSUPPORTED_FILE_TYPE' }, { status: 400 })
  }

  let transactions

  try {
    if (premium) {
      transactions = await extractWithClaude(buffer, fileType)
    } else if (isPDF) {
      const rawText = await extractFromPDF(buffer, pdfPassword)
      transactions = parseTransactionsFromText(rawText)
    } else {
      const rawText = await extractTextWithTextract(buffer)
      transactions = parseTransactionsFromText(rawText)
    }
  } catch (err: unknown) {
    const errCode = (err as { code?: string }).code
    if (errCode === 'PASSWORD_PROTECTED' || errCode === 'WRONG_PDF_PASSWORD') {
      return NextResponse.json({ error: errCode }, { status: 422 })
    }
    throw err
  }

  return NextResponse.json({ transactions })
}
