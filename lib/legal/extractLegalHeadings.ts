import GithubSlugger from 'github-slugger'

export interface LegalHeading {
  /** Same id rehype-slug gives the rendered heading, so `#id` links land on it. */
  id: string
  /** Full heading text, e.g. "1. Who we are". */
  text: string
  /** Section number when the heading starts with one, e.g. "1". */
  number?: string
  /** Heading text without the leading number, e.g. "Who we are". */
  label: string
}

const NUMBERED_HEADING_PATTERN = /^(\d+)\.\s+(.*)$/

/** Split "1. Who we are" into its number and label. Unnumbered text is all label. */
export function splitHeadingNumber(text: string): { number?: string; label: string } {
  const match = NUMBERED_HEADING_PATTERN.exec(text)
  return match ? { number: match[1], label: match[2] } : { label: text }
}

/** Heading level listed in the "On this page" nav. The legal content uses H3 for its sections. */
export const LEGAL_TOC_HEADING_LEVEL = 3

const ATX_HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const FENCE_PATTERN = /^\s*(```|~~~)/

/** Reduce inline markdown to the plain text rehype-slug sees. */
function toPlainText(markdownInline: string): string {
  return markdownInline
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images -> their text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .trim()
}

/**
 * List the section headings for the table of contents.
 *
 * Every heading is slugged in document order (not just H3s) because
 * rehype-slug shares one slugger across all levels - a duplicate title
 * anywhere shifts the `-1` suffixes, and the ids must match exactly.
 */
export function extractLegalHeadings(markdown: string): LegalHeading[] {
  const slugger = new GithubSlugger()
  const headings: LegalHeading[] = []
  let insideFence = false

  for (const line of markdown.split(/\r?\n/)) {
    if (FENCE_PATTERN.test(line)) {
      insideFence = !insideFence
      continue
    }
    if (insideFence) continue

    const match = ATX_HEADING_PATTERN.exec(line)
    if (!match) continue

    const text = toPlainText(match[2])
    const id = slugger.slug(text)
    if (match[1].length === LEGAL_TOC_HEADING_LEVEL) headings.push({ id, text, ...splitHeadingNumber(text) })
  }

  return headings
}
