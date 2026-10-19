import { generateLegalMetadata, LegalDocumentPage } from '@/components/legal/LegalDocumentPage'
import type { LegalDocumentSlug } from '@/lib/legal/legalDocuments'

const SLUG: LegalDocumentSlug = 'security'

export function generateMetadata() {
  return generateLegalMetadata(SLUG)
}

export default function SecurityPage() {
  return <LegalDocumentPage slug={SLUG} />
}
