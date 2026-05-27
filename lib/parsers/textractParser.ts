import { createWorker } from 'tesseract.js'

export async function extractTextWithTextract(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker('eng')
  const { data } = await worker.recognize(imageBuffer)
  await worker.terminate()
  return data.text
}
