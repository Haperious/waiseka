import { readFileSync } from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { extractLegalHeadings } from './extractLegalHeadings'
import { LEGAL_DOCUMENT_SLUGS } from './legalDocuments'
import { LEGAL_TOKEN_ENV_VARS } from './legalEnv'
import { parseLegalDocument } from './parseLegalDocument'

/**
 * Integrity checks on the real policy files in content/legal/. These guard
 * the lawyer's edits: a typo'd token or a stray em dash fails CI, not prod.
 */

const CONTENT_DIR = path.join(process.cwd(), 'content', 'legal')
const KNOWN_TOKEN_NAMES = Object.keys(LEGAL_TOKEN_ENV_VARS)
const PLACEHOLDER_PATTERN = /\{\{([^}]*)\}\}/g
const EM_DASH = '—'
const FIXTURE_EFFECTIVE_DATE = '2026-10-15'

const completeTokenFixture = Object.fromEntries(KNOWN_TOKEN_NAMES.map((name) => [name, `fixture-${name.toLowerCase()}`]))

const readRaw = (slug: string) => readFileSync(path.join(CONTENT_DIR, `${slug}.md`), 'utf8')
const placeholdersIn = (text: string) => [...text.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1])

describe.each(LEGAL_DOCUMENT_SLUGS)('content/legal/%s.md', (slug) => {
  const raw = readRaw(slug)

  it('has a title and a quoted version in its frontmatter', () => {
    const { data } = matter(raw)
    expect(typeof data.title).toBe('string')
    expect(data.title.trim()).not.toBe('')
    expect(typeof data.version).toBe('string')
  })

  it('leaves zero placeholders once resolved with a complete token set', () => {
    const document = parseLegalDocument(raw, completeTokenFixture, FIXTURE_EFFECTIVE_DATE, slug)
    expect(document.body).not.toContain('{{')
    expect(document.title).not.toContain('{{')
    expect(document.effectiveDate).toBe(FIXTURE_EFFECTIVE_DATE)
  })

  it('contains no em dashes', () => {
    expect(raw).not.toContain(EM_DASH)
  })

  it('only uses known token names', () => {
    const unknown = placeholdersIn(raw).filter((name) => !KNOWN_TOKEN_NAMES.includes(name))
    expect(unknown).toEqual([])
  })

  it('has sections for the "On this page" list, with unique anchors', () => {
    const ids = extractLegalHeadings(matter(raw).content).map((heading) => heading.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('content/legal token coverage', () => {
  it('uses every configured token somewhere, so no env var is dead config', () => {
    const used = new Set(LEGAL_DOCUMENT_SLUGS.flatMap((slug) => placeholdersIn(readRaw(slug))))
    expect(KNOWN_TOKEN_NAMES.filter((name) => !used.has(name))).toEqual([])
  })
})
