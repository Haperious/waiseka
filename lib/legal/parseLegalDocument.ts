import matter from 'gray-matter'
import { resolveLegalTokens } from './resolveLegalTokens'

export interface LegalDocument {
  title: string
  /** Taglish subtitle, shown under the title when present (security page). */
  titleTl?: string
  version: string
  /** ISO date (YYYY-MM-DD). Comes from config, not the file. */
  effectiveDate: string
  /** Markdown body with every `{{TOKEN}}` resolved. */
  body: string
}

export class LegalDocumentError extends Error {
  readonly source: string

  constructor(source: string, problem: string) {
    super(`Legal document "${source}" is invalid: ${problem}`)
    this.name = 'LegalDocumentError'
    this.source = source
  }
}

function readRequiredString(data: Record<string, unknown>, field: string, source: string): string {
  const value = data[field]
  if (typeof value !== 'string' || value.trim() === '') {
    // An unquoted `version: 1.0` parses as the number 1 - insist on a string
    throw new LegalDocumentError(source, `frontmatter "${field}" must be a non-empty quoted string`)
  }
  return value.trim()
}

function readOptionalString(data: Record<string, unknown>, field: string, source: string): string | undefined {
  if (data[field] === undefined) return undefined
  return readRequiredString(data, field, source)
}

/**
 * Parse a legal markdown file's frontmatter and resolve its tokens.
 * Pure (no fs or env) so tests can run it against the real content files.
 *
 * @param source  Label used in error messages, e.g. the file name.
 * @throws LegalDocumentError for missing/invalid frontmatter.
 * @throws MissingLegalTokenError if any `{{TOKEN}}` is unresolved, in the title or body.
 */
export function parseLegalDocument(
  rawMarkdown: string,
  tokens: Record<string, string>,
  effectiveDate: string,
  source: string
): LegalDocument {
  const { data, content } = matter(rawMarkdown)

  const titleTl = readOptionalString(data, 'titleTl', source)

  return {
    title: resolveLegalTokens(readRequiredString(data, 'title', source), tokens),
    ...(titleTl !== undefined && { titleTl: resolveLegalTokens(titleTl, tokens) }),
    version: readRequiredString(data, 'version', source),
    effectiveDate,
    body: resolveLegalTokens(content, tokens),
  }
}
