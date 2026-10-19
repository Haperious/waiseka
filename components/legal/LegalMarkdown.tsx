import Link from 'next/link'
import Markdown, { type Components } from 'react-markdown'
import type { Element, ElementContent } from 'hast'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { ShieldOff } from 'lucide-react'
import { splitHeadingNumber } from '@/lib/legal/extractLegalHeadings'
import { rehypeSectionCards } from '@/lib/legal/rehypeSectionCards'
import { rehypeSummaryCallouts } from '@/lib/legal/rehypeSummaryCallouts'
import { SummaryCallout } from './SummaryCallout'
import styles from './legal.module.css'

const EXTERNAL_URL_PATTERN = /^https?:\/\//i

/** Paragraphs opening with one of these bold phrases render as a warning note. */
const ALERT_PREFIXES = ['What we never collect']

function textOf(node: ElementContent | Element): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(textOf).join('')
  return ''
}

function isAlertParagraph(node: Element | undefined): boolean {
  const first = node?.children[0]
  if (first?.type !== 'element' || first.tagName !== 'strong') return false
  const label = textOf(first)
  return ALERT_PREFIXES.some((prefix) => label.startsWith(prefix))
}

const markdownComponents: Components = {
  a({ href = '', children, node: _node, ...rest }) {
    // App routes: client-side navigation
    if (href.startsWith('/')) {
      return <Link href={href} {...rest}>{children}</Link>
    }
    if (EXTERNAL_URL_PATTERN.test(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
          <span className={styles.srOnly}> (opens in a new tab)</span>
        </a>
      )
    }
    // In-page anchors and mailto: links stay plain
    return <a href={href} {...rest}>{children}</a>
  },
  h3({ node, children, ...rest }) {
    const { number, label } = splitHeadingNumber(node ? textOf(node) : '')
    // Inline markup in a numbered heading can't be split safely, so keep it whole
    if (!number || typeof children !== 'string') return <h3 {...rest}>{children}</h3>

    return (
      <h3 {...rest}>
        <span className={styles.sectionNumber} aria-hidden="true">{number.padStart(2, '0')}</span>
        <span className={styles.srOnly}>{number}. </span>
        {label}
      </h3>
    )
  },
  p({ node, children, ...rest }) {
    if (!isAlertParagraph(node)) return <p {...rest}>{children}</p>

    return (
      <div role="note" className={styles.alert}>
        <ShieldOff size={16} strokeWidth={2} className={styles.alertIcon} aria-hidden />
        <p {...rest}>{children}</p>
      </div>
    )
  },
  table({ node: _node, ...rest }) {
    return (
      // Focusable so keyboard users can scroll a wide table sideways
      <div className={styles.tableScroll} role="region" aria-label="Table, scroll sideways to see all columns" tabIndex={0}>
        <table {...rest} />
      </div>
    )
  },
  blockquote: SummaryCallout,
}

/**
 * Render resolved legal markdown. Raw HTML in the markdown is not rendered
 * (react-markdown's default), and rehype-slug gives each heading the id the
 * "On this page" links point to. Each H3 section becomes a card.
 */
export function LegalMarkdown({ body }: { body: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug, rehypeSummaryCallouts, [rehypeSectionCards, { className: styles.sectionCard }]]}
      components={markdownComponents}
    >
      {body}
    </Markdown>
  )
}
