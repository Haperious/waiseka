'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { LegalHeading } from '@/lib/legal/extractLegalHeadings'
import styles from './legal.module.css'

const TOC_HEADING_ID = 'legal-toc-heading'
/** Sticky header height plus breathing room; matches the headings' scroll-margin-top. */
const SCROLL_SPY_ROOT_MARGIN = '-88px 0px -60% 0px'

interface LegalTocProps {
  headings: LegalHeading[]
  /** Rendered under the list, e.g. the privacy help box. */
  footer?: ReactNode
}

/** Track which section heading is at the top of the viewport. */
function useActiveHeading(ids: string[]): string | undefined {
  const [activeId, setActiveId] = useState(ids[0])

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el) => el !== null)
    if (elements.length === 0) return

    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        // Topmost visible heading wins; when none is in the band, keep the last one
        const topmost = ids.find((id) => visible.has(id))
        if (topmost) setActiveId(topmost)
      },
      { rootMargin: SCROLL_SPY_ROOT_MARGIN }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  return activeId
}

function TocList({ headings, activeId }: { headings: LegalHeading[]; activeId?: string }) {
  return (
    <ol className={styles.tocList}>
      {headings.map((heading) => {
        const isActive = heading.id === activeId
        return (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={isActive ? `${styles.tocLink} ${styles.tocLinkActive}` : styles.tocLink}
              aria-current={isActive ? 'location' : undefined}
            >
              {heading.label}
            </a>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * "On this page" navigation. Wide screens get a sticky sidebar with a
 * scroll-spy highlight; narrow screens get a collapsible list above the
 * article. CSS shows one or the other, so only one is in the a11y tree.
 */
export function LegalToc({ headings, footer }: LegalTocProps) {
  const [ids] = useState(() => headings.map((heading) => heading.id))
  const activeId = useActiveHeading(ids)

  return (
    <div className={styles.tocColumn}>
      <nav className={styles.toc} aria-labelledby={TOC_HEADING_ID}>
        <h2 id={TOC_HEADING_ID} className={styles.tocHeading}>On this page</h2>
        <TocList headings={headings} activeId={activeId} />
        {footer}
      </nav>

      <details className={styles.tocCollapsible}>
        <summary className={styles.tocSummary}>On this page</summary>
        <nav aria-label="On this page">
          <TocList headings={headings} />
          {footer}
        </nav>
      </details>
    </div>
  )
}
