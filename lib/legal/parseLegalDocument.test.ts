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

  describe('hero and glance', () => {
    const BODY = '### 1. Who we are\n\ntext\n\n### 3. Why we use it\n\ntext\n'
    const withFrontmatter = (extra: string) => parse(`---\ntitle: Privacy\nversion: "1.0"\n${extra}\n---\n${BODY}`)

    it('omits both when the frontmatter has neither', () => {
      const doc = withFrontmatter('')
      expect(doc).not.toHaveProperty('hero')
      expect(doc).not.toHaveProperty('glance')
    })

    it('reads the hero and resolves its tokens', () => {
      const doc = withFrontmatter('hero:\n  title: "Your data at {{WEBSITE_URL}},"\n  emphasis: "your rules."')
      expect(doc.hero).toEqual({ title: 'Your data at https://example.com,', emphasis: 'your rules.' })
    })

    it('allows a hero without emphasis', () => {
      expect(withFrontmatter('hero:\n  title: "Plain"').hero).toEqual({ title: 'Plain' })
    })

    it('reads glance cards with and without a section', () => {
      const doc = withFrontmatter('glance:\n  - icon: Ban\n    title: "No ads."\n    section: 3\n  - icon: Lock\n    title: "{{WEBSITE_URL}}"')
      expect(doc.glance).toEqual([
        { icon: 'Ban', title: 'No ads.', section: 3 },
        { icon: 'Lock', title: 'https://example.com' },
      ])
    })

    it.each([
      ['hero that is a string', 'hero: "Your data"'],
      ['hero without a title', 'hero:\n  emphasis: "your rules."'],
      ['empty emphasis', 'hero:\n  title: "A"\n  emphasis: ""'],
      ['glance that is not a list', 'glance: "No ads"'],
      ['empty glance list', 'glance: []'],
      ['unknown icon', 'glance:\n  - icon: Banana\n    title: "No ads."'],
      ['missing icon', 'glance:\n  - title: "No ads."'],
      ['missing card title', 'glance:\n  - icon: Ban'],
      ['section with no matching heading', 'glance:\n  - icon: Ban\n    title: "No ads."\n    section: 2'],
      ['section that is a string', 'glance:\n  - icon: Ban\n    title: "No ads."\n    section: "3"'],
    ])('rejects a %s', (_case, extra) => {
      expect(() => withFrontmatter(extra)).toThrow(LegalDocumentError)
    })
  })
})
