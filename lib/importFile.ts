export type ImportFileType = 'application/pdf' | 'image/png' | 'image/jpeg'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** The file's real type from its first bytes - the browser-reported type is client-controlled. */
export function sniffImportFileType(bytes: Buffer): ImportFileType | null {
  if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}
