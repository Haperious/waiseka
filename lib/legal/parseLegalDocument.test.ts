import { describe, expect, it } from 'vitest'
import { LegalDocumentError, parseLegalDocument } from './parseLegalDocument'
import { MissingLegalTokenError } from './resolveLegalTokens'

const TOKENS = { WEBSITE_URL: 'https://example.com' }
const DATE = '2026-10-15'
const parse = (raw: string) => parseLegalDocument(raw, TOKENS, DATE, 'test.md')

describe('parseLegalDocument', () => {
  it('returns frontmatter fields, the configured date and the resolved body', () => {
    const doc = parse('---\ntitle: Terms\ntitleTl: Mga Tuntunin\nversion: "1.2"\n---\n\nVisit {{WEBSITE_URL}}.\n')
    expect(doc).toEqual({
      title: 'Terms',
      titleTl: 'Mga Tuntunin',
      version: '1.2',
      effectiveDate: DATE,
      body: '\nVisit https://example.com.\n',
    })
  })

  it('omits titleTl when the frontmatter has none', () => {
    expect(parse('---\ntitle: Terms\nversion: "1.0"\n---\nBody')).not.toHaveProperty('titleTl')
  })

  it('rejects an unquoted version, which YAML would turn into a number', () => {
    expect(() => parse('---\ntitle: Terms\nversion: 1.0\n---\nBody')).toThrow(LegalDocumentError)
  })

  it.each([
    ['missing title', '---\nversion: "1.0"\n---\nBody'],
    ['empty title', '---\ntitle: ""\nversion: "1.0"\n---\nBody'],
    ['missing version', '---\ntitle: Terms\n---\nBody'],
    ['no frontmatter', 'Just a body'],
  ])('rejects %s, naming the file', (_case, raw) => {
    expect(() => parse(raw)).toThrow(/test\.md/)
  })

  it('throws MissingLegalTokenError for an unresolved token in the body', () => {
    expect(() => parse('---\ntitle: Terms\nversion: "1.0"\n---\n{{DISPUTE_CITY}}')).toThrow(MissingLegalTokenError)
  })
})
