import { describe, expect, it } from 'vitest'
import { extractLegalHeadings } from './extractLegalHeadings'

describe('extractLegalHeadings', () => {
  it('lists H3 sections with rehype-slug style ids', () => {
    expect(extractLegalHeadings('### 1. Who we are\n\ntext\n\n### 4. What WaiseKa is - and is not')).toEqual([
      { id: '1-who-we-are', text: '1. Who we are' },
      { id: '4-what-waiseka-is---and-is-not', text: '4. What WaiseKa is - and is not' },
    ])
  })

  it('skips other heading levels but still counts them for duplicate suffixes', () => {
    const markdown = '## Contact\n\n### Contact\n\n### Contact'
    expect(extractLegalHeadings(markdown).map((h) => h.id)).toEqual(['contact-1', 'contact-2'])
  })

  it('strips inline markdown from the heading text', () => {
    expect(extractLegalHeadings('### **Found** a [security](/security) `issue`?')).toEqual([
      { id: 'found-a-security-issue', text: 'Found a security issue?' },
    ])
  })

  it('ignores heading-like lines inside fenced code', () => {
    expect(extractLegalHeadings('```\n### not a heading\n```\n### Real')).toEqual([{ id: 'real', text: 'Real' }])
  })

  it('handles Windows line endings', () => {
    expect(extractLegalHeadings('### One\r\n\r\n### Two\r\n').map((h) => h.text)).toEqual(['One', 'Two'])
  })
})
