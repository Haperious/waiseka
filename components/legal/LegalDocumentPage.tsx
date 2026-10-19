import type { Metadata } from 'next'
import { loadLegalDocument } from '@/lib/legal/loadLegalDocument'
import { LEGAL_DOCUMENT_DESCRIPTIONS, type LegalDocumentSlug } from '@/lib/legal/legalDocuments'
import { isLegalPagesPublic } from '@/lib/legal/visibility'
import { LegalMarkdown } from './LegalMarkdown'
import { LegalPageLayout } from './LegalPageLayout'

const SITE_NAME = 'WaiseKa'

/** Shared `generateMetadata` body for the three legal routes. */
export async function generateLegalMetadata(slug: LegalDocumentSlug): Promise<Metadata> {
  const document = await loadLegalDocument(slug)
  return {
    title: `${document.title} | ${SITE_NAME}`,
    description: LEGAL_DOCUMENT_DESCRIPTIONS[slug],
    // Reachable by URL for review, but kept out of search until the flag is flipped
    ...(!isLegalPagesPublic() && { robots: { index: false, follow: false } }),
  }
}

/** Server component that renders one legal document. Load errors propagate to app/error.tsx. */
export async function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
  const document = await loadLegalDocument(slug)
  return (
    <LegalPageLayout slug={slug} document={document}>
      <LegalMarkdown body={document.body} />
    </LegalPageLayout>
  )
}
