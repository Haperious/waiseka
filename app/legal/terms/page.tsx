import { generateLegalMetadata, LegalDocumentPage } from '@/components/legal/LegalDocumentPage'
import type { LegalDocumentSlug } from '@/lib/legal/legalDocuments'

const SLUG: LegalDocumentSlug = 'terms'

export function generateMetadata() {
  return generateLegalMetadata(SLUG)
}

export default function TermsPage() {
  return <LegalDocumentPage slug={SLUG} />
}
