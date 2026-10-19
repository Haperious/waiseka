import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import { describe, expect, it } from 'vitest'
import { rehypeSummaryCallouts } from './rehypeSummaryCallouts'

const render = (markdown: string) =>
  renderToStaticMarkup(createElement(Markdown, { rehypePlugins: [rehypeSummaryCallouts] }, markdown))

describe('rehypeSummaryCallouts', () => {
  it('strips the bold label with its colon and marks the blockquote', () => {
    expect(render('> **Sa madaling salita:** Data mo yan.')).toBe(
      '<blockquote data-summary-callout="true">\n<p>Data mo yan.</p>\n</blockquote>'
    )
  })

  it('strips a colon placed outside the bold', () => {
    expect(render('> **Sa madaling salita**: Data mo yan.')).toContain('<p>Data mo yan.</p>')
  })

  it('leaves other blockquotes untouched', () => {
    expect(render('> **Note:** something')).toBe('<blockquote>\n<p><strong>Note:</strong> something</p>\n</blockquote>')
  })

  it('only strips the label when it opens the blockquote', () => {
    expect(render('> Intro **Sa madaling salita:** text')).not.toContain('data-summary-callout')
  })
})
