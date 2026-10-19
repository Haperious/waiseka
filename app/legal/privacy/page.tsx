import { generateLegalMetadata, LegalDocumentPage } from '@/components/legal/LegalDocumentPage'
import type { LegalDocumentSlug } from '@/lib/legal/legalDocuments'

const SLUG: LegalDocumentSlug = 'privacy'

export function generateMetadata() {
  return generateLegalMetadata(SLUG)
}

export default function PrivacyPage() {
  return <LegalDocumentPage slug={SLUG} />
}
