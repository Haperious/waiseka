import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { releaseImport, reserveImport } from '@/lib/importUsage'
import { FREE_IMPORT_LIMIT, MAX_IMPORT_FILE_BYTES, PREMIUM_IMPORT_LIMIT } from '@/lib/constants'
import { extractFromPDF } from '@/lib/parsers/pdfParser'
import { extractTextWithTextract } from '@/lib/parsers/textractParser'
import { extractWithClaude } from '@/lib/parsers/claudeParser'
import { parseTransactionsFromText } from '@/lib/parsers/transactionParser'
import { sniffImportFileType } from '@/lib/importFile'
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'

// Room for the multipart boundaries and the other form fields around the file
const MAX_BODY_BYTES = MAX_IMPORT_FILE_BYTES + 64 * 1024

const fileTooLarge = () => NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 })

export async function POST(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Turn away oversized bodies before formData() reads them into memory
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fileTooLarge()

  const userId = session.user.id
  const db = await getDb()
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const premium = isPremium({ tier: user.tier, premiumOverride: user.premiumOverride })

  const formData = await req.formData()
  const file = formData.get('file')
  const password = formData.get('pdfPassword')
  const pdfPassword = typeof password === 'string' && password ? password : undefined

  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_IMPORT_FILE_BYTES) return fileTooLarge()

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileType = sniffImportFileType(buffer)
  if (!fileType) return NextResponse.json({ error: 'UNSUPPORTED_FILE_TYPE' }, { status: 400 })

  // Counted here, before any paid extraction runs, so repeat uploads can't skip the limit
  if (!(await reserveImport(userId, premium ? PREMIUM_IMPORT_LIMIT : FREE_IMPORT_LIMIT))) {
    return NextResponse.json({ error: 'IMPORT_LIMIT_REACHED' }, { status: 429 })
  }

  let transactions

  try {
    if (premium) {
      transactions = await extractWithClaude(buffer, fileType)
    } else if (fileType === 'application/pdf') {
      const rawText = await extractFromPDF(buffer, pdfPassword)
      transactions = parseTransactionsFromText(rawText)
    } else {
      const rawText = await extractTextWithTextract(buffer)
      transactions = parseTransactionsFromText(rawText)
    }
  } catch (err: unknown) {
    const errCode = (err as { code?: string }).code
    if (errCode === 'PASSWORD_PROTECTED' || errCode === 'WRONG_PDF_PASSWORD') {
      // Nothing was extracted - the retry with a password shouldn't cost a second import
      await releaseImport(userId)
      return NextResponse.json({ error: errCode }, { status: 422 })
    }
    throw err
  }

  return NextResponse.json({ transactions })
}
