import type { ComponentProps } from 'react'
import type { ExtraProps } from 'react-markdown'
import styles from './legal.module.css'

/**
 * Renders markdown blockquotes. In the legal content the only blockquotes are
 * the Taglish "Sa madaling salita" summaries, so every one is styled as a
 * summary note rather than a quotation.
 */
export function SummaryCallout({ children }: ComponentProps<'blockquote'> & ExtraProps) {
  return (
    <aside className={styles.callout} aria-label="Sa madaling salita (summary)" lang="tl">
      {children}
    </aside>
  )
}
