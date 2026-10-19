import type { ComponentProps } from 'react'
import type { ExtraProps } from 'react-markdown'
import { MessageCircle } from 'lucide-react'
import { SUMMARY_CALLOUT_PROPERTY, SUMMARY_LABEL } from '@/lib/legal/rehypeSummaryCallouts'
import styles from './legal.module.css'

/**
 * Renders markdown blockquotes. The Taglish "Sa madaling salita" summaries
 * (label already stripped by rehypeSummaryCallouts) get the label back as an
 * eyebrow; any other blockquote renders as a plain quotation.
 */
export function SummaryCallout({ children, node }: ComponentProps<'blockquote'> & ExtraProps) {
  if (!node?.properties[SUMMARY_CALLOUT_PROPERTY]) {
    return <blockquote className={styles.quote}>{children}</blockquote>
  }

  return (
    <aside className={styles.callout} aria-label={`${SUMMARY_LABEL} (summary)`} lang="tl">
      <p className={styles.calloutEyebrow} aria-hidden="true">
        <MessageCircle size={13} strokeWidth={2} />
        {SUMMARY_LABEL}
      </p>
      {children}
    </aside>
  )
}
