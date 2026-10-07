/**
 * Whether the legal pages are public: indexed by search engines and linked
 * from the footer and Settings. While false they still work by direct URL
 * (for the lawyer's review) but are noindex and unlinked.
 *
 * NEXT_PUBLIC_ so the same flag is available to client components; it is
 * inlined at build time, so changing it needs a redeploy.
 */
const LEGAL_PAGES_PUBLIC_VALUE = 'true'

export function isLegalPagesPublic(): boolean {
  return process.env.NEXT_PUBLIC_LEGAL_PAGES_PUBLIC === LEGAL_PAGES_PUBLIC_VALUE
}
