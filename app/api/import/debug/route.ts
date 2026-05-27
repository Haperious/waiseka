import { auth } from '@/auth'
import { extractFromPDF } from '@/lib/parsers/pdfParser'
import { NextRequest, NextResponse } from 'next/server'

// Temporary debug route — remove after diagnosing the parser
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const pdfPassword = (formData.get('pdfPassword') as string | null) ?? undefined
  const rawText = await extractFromPDF(buffer, pdfPassword)

  return NextResponse.json({ rawText, lines: rawText.split('\n').filter((l) => l.trim().length > 0) })
}
