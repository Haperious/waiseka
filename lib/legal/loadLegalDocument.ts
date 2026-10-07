import 'server-only'
import { readFile } from 'fs/promises'
import path from 'path'
import { legalEffectiveDate, legalTokens } from './config'
import { isLegalDocumentSlug, type LegalDocumentSlug } from './legalDocuments'
import { parseLegalDocument, type LegalDocument } from './parseLegalDocument'

export { LegalDocumentError, type LegalDocument } from './parseLegalDocument'
export { MissingLegalTokenError } from './resolveLegalTokens'

/** Relative to the project root; also listed in next.config.ts outputFileTracingIncludes. */
const LEGAL_CONTENT_DIR = path.join('content', 'legal')

// Content and config are fixed for the life of a deploy, so each document is
// read and parsed once per server instance. Failures are not cached.
const documentCache = new Map<LegalDocumentSlug, Promise<LegalDocument>>()

async function readAndParse(slug: LegalDocumentSlug): Promise<LegalDocument> {
  const fileName = `${slug}.md`
  const rawMarkdown = await readFile(path.join(process.cwd(), LEGAL_CONTENT_DIR, fileName), 'utf8')
  return parseLegalDocument(rawMarkdown, legalTokens, legalEffectiveDate, fileName)
}

/**
 * Load a legal document with its tokens resolved. Server components only.
 * Errors (missing file, bad frontmatter, unresolved token) propagate to the caller.
 */
export function loadLegalDocument(slug: LegalDocumentSlug): Promise<LegalDocument> {
  // Guards the fs path against anything that slipped past the type system
  if (!isLegalDocumentSlug(slug)) {
    return Promise.reject(new Error(`Unknown legal document slug: ${String(slug)}`))
  }

  const cached = documentCache.get(slug)
  if (cached) return cached

  const pending = readAndParse(slug)
  documentCache.set(slug, pending)
  // Evict on failure so the next request retries; the caller still receives the rejection via `pending`
  pending.catch(() => documentCache.delete(slug))
  return pending
}
