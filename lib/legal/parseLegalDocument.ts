import matter from 'gray-matter'
import { extractLegalHeadings } from './extractLegalHeadings'
import { resolveLegalTokens } from './resolveLegalTokens'

/**
 * Icons a glance card may name. The component map in
 * components/legal/legalIcons.tsx is typed against this list.
 */
export const LEGAL_GLANCE_ICON_NAMES = [
  'Ban',
  'BellRing',
  'FileText',
  'FileX',
  'KeyRound',
  'Lock',
  'Shield',
  'ShieldCheck',
  'Trash2',
  'UserCheck',
] as const

export type LegalGlanceIconName = (typeof LEGAL_GLANCE_ICON_NAMES)[number]

export interface LegalHero {
  title: string
  /** Shown after the title in italic accent, e.g. "your rules." */
  emphasis?: string
}

export interface LegalGlanceItem {
  icon: LegalGlanceIconName
  title: string
  /** Number of the H3 section the card links to, e.g. 3 for "### 3. Why we use it". */
  section?: number
}

export interface LegalDocument {
  title: string
  /** Taglish subtitle, shown under the title when present (security page). */
  titleTl?: string
  version: string
  /** ISO date (YYYY-MM-DD). Comes from config, not the file. */
  effectiveDate: string
  /** Markdown body with every `{{TOKEN}}` resolved. */
  body: string
  /** Hero headline. Without it the page uses `title`. */
  hero?: LegalHero
  /** "At a glance" cards under the hero. */
  glance?: LegalGlanceItem[]
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readHero(data: Record<string, unknown>, tokens: Record<string, string>, source: string): LegalHero | undefined {
  const raw = data.hero
  if (raw === undefined) return undefined
  if (!isRecord(raw)) throw new LegalDocumentError(source, 'frontmatter "hero" must be an object with a "title"')

  const emphasis = readOptionalString(raw, 'emphasis', source)
  return {
    title: resolveLegalTokens(readRequiredString(raw, 'title', source), tokens),
    ...(emphasis !== undefined && { emphasis: resolveLegalTokens(emphasis, tokens) }),
  }
}

function readGlance(
  data: Record<string, unknown>,
  tokens: Record<string, string>,
  sectionNumbers: Set<string>,
  source: string
): LegalGlanceItem[] | undefined {
  const raw = data.glance
  if (raw === undefined) return undefined
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new LegalDocumentError(source, 'frontmatter "glance" must be a non-empty list')
  }

  return raw.map((item, index) => {
    const where = `glance[${index}]`
    if (!isRecord(item)) throw new LegalDocumentError(source, `${where} must be an object`)

    const icon = item.icon
    if (typeof icon !== 'string' || !(LEGAL_GLANCE_ICON_NAMES as readonly string[]).includes(icon)) {
      throw new LegalDocumentError(source, `${where}.icon must be one of ${LEGAL_GLANCE_ICON_NAMES.join(', ')}`)
    }

    const section = item.section
    if (section !== undefined) {
      if (typeof section !== 'number' || !Number.isInteger(section) || !sectionNumbers.has(String(section))) {
        throw new LegalDocumentError(source, `${where}.section must be the number of a "### N." heading in the body`)
      }
    }

    return {
      icon: icon as LegalGlanceIconName,
      title: resolveLegalTokens(readRequiredString(item, 'title', `${source} ${where}`), tokens),
      ...(section !== undefined && { section }),
    }
  })
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
  const sectionNumbers = new Set(extractLegalHeadings(content).flatMap((heading) => heading.number ?? []))
  const hero = readHero(data, tokens, source)
  const glance = readGlance(data, tokens, sectionNumbers, source)

  return {
    title: resolveLegalTokens(readRequiredString(data, 'title', source), tokens),
    ...(titleTl !== undefined && { titleTl: resolveLegalTokens(titleTl, tokens) }),
    version: readRequiredString(data, 'version', source),
    effectiveDate,
    body: resolveLegalTokens(content, tokens),
    ...(hero !== undefined && { hero }),
    ...(glance !== undefined && { glance }),
  }
}
