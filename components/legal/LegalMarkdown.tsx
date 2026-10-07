import Link from 'next/link'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { SummaryCallout } from './SummaryCallout'
import styles from './legal.module.css'

const EXTERNAL_URL_PATTERN = /^https?:\/\//i

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
 * "On this page" links point to.
 */
export function LegalMarkdown({ body }: { body: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={markdownComponents}>
      {body}
    </Markdown>
  )
}
