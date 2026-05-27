import path from 'path'
import { pathToFileURL } from 'url'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export async function extractFromPDF(fileBuffer: Buffer, password?: string): Promise<string> {
  // pdfjs-dist v5 is ESM-only — must use dynamic import()
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // On Windows, bare C:\ paths are rejected by the ESM loader — must be a file:// URL
  const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href

  const loadParams: Record<string, unknown> = { data: new Uint8Array(fileBuffer) }
  if (password) loadParams.password = password

  let pdf: PDFDocumentProxy
  try {
    pdf = await pdfjs.getDocument(loadParams).promise
  } catch (err: unknown) {
    const name = (err as { name?: string }).name
    if (name === 'PasswordException') {
      const code = (err as { code?: number }).code
      // code 1 = NEED_PASSWORD (first attempt, no password given)
      // code 2 = INCORRECT_PASSWORD (password was given but wrong)
      throw Object.assign(new Error('PDF is password protected'), {
        code: code === 2 ? 'WRONG_PDF_PASSWORD' : 'PASSWORD_PROTECTED',
      })
    }
    throw err
  }
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    fullText += pageText + '\n'
  }

  return fullText
}
