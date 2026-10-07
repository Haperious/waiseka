/**
 * The legal documents in content/legal/ and the routes that render them.
 * Client-safe: no fs or env access, so links and the proxy can import it.
 */

export const LEGAL_DOCUMENT_SLUGS = ['privacy', 'terms', 'security'] as const

export type LegalDocumentSlug = (typeof LEGAL_DOCUMENT_SLUGS)[number]

/** Public route for each document. Security sits at the top level, not under /legal. */
export const LEGAL_DOCUMENT_PATHS: Record<LegalDocumentSlug, string> = {
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  security: '/security',
}

/** Short names for links (footer, Settings, cross-links). Page titles come from the content frontmatter. */
export const LEGAL_DOCUMENT_LINK_LABELS: Record<LegalDocumentSlug, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  security: 'Security',
}

export function isLegalDocumentSlug(value: string): value is LegalDocumentSlug {
  return (LEGAL_DOCUMENT_SLUGS as readonly string[]).includes(value)
}
