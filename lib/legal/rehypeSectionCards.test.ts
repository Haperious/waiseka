import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import { describe, expect, it } from 'vitest'
import { rehypeSectionCards } from './rehypeSectionCards'

const render = (markdown: string) =>
  renderToStaticMarkup(
    createElement(Markdown, { rehypePlugins: [rehypeSlug, [rehypeSectionCards, { className: 'card' }]] }, markdown)
  )

describe('rehypeSectionCards', () => {
  it('wraps each H3 and the content after it in a labelled section', () => {
    expect(render('### 1. One\n\nFirst\n\n### 2. Two\n\nSecond\n\n- item')).toBe(
      '<section class="card" aria-labelledby="1-one"><h3 id="1-one">1. One</h3>\n<p>First</p>\n</section>' +
        '<section class="card" aria-labelledby="2-two"><h3 id="2-two">2. Two</h3>\n<p>Second</p>\n<ul>\n<li>item</li>\n</ul></section>'
    )
  })

  it('leaves content before the first H3 outside any section', () => {
    expect(render('**Intro**\n\n### Next\n\nBody')).toMatch(/^<p><strong>Intro<\/strong><\/p>\n<section class="card"/)
  })

  it('keeps nested headings inside the current section', () => {
    const html = render('### Top\n\n> ### Quoted\n\nAfter')
    expect(html.match(/<section/g)).toHaveLength(1)
  })

  it('does nothing when there are no H3s', () => {
    expect(render('## Only H2\n\ntext')).not.toContain('<section')
  })
})
