import type { ReactNode } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { extractLegalHeadings } from '@/lib/legal/extractLegalHeadings'
import {
  LEGAL_DOCUMENT_LINK_LABELS,
  LEGAL_DOCUMENT_PATHS,
  LEGAL_DOCUMENT_SLUGS,
  type LegalDocumentSlug,
} from '@/lib/legal/legalDocuments'
import type { LegalDocument } from '@/lib/legal/parseLegalDocument'
import styles from './legal.module.css'

const EFFECTIVE_DATE_FORMAT = 'd MMMM yyyy'
const TOC_HEADING_ID = 'legal-toc-heading'
const RELATED_HEADING_ID = 'legal-related-heading'

interface LegalPageLayoutProps {
  slug: LegalDocumentSlug
  document: LegalDocument
  /** The rendered body, normally <LegalMarkdown body={document.body} />. */
  children: ReactNode
}

export function LegalPageLayout({ slug, document, children }: LegalPageLayoutProps) {
  const headings = extractLegalHeadings(document.body)
  const otherSlugs = LEGAL_DOCUMENT_SLUGS.filter((other) => other !== slug)

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link href="/" className={styles.brand}>WaiseKa</Link>
        </div>
      </header>

      <main className={styles.main}>
        <header className={styles.docHeader}>
          <h1 className={styles.title}>{document.title}</h1>
          {document.titleTl && (
            <p className={styles.subtitle} lang="tl">{document.titleTl}</p>
          )}
          <p className={styles.meta}>
            Effective <time dateTime={document.effectiveDate}>{format(parseISO(document.effectiveDate), EFFECTIVE_DATE_FORMAT)}</time>
            {' · '}Version {document.version}
          </p>
        </header>

        <div className={styles.layout}>
          {headings.length > 0 && (
            <nav className={styles.toc} aria-labelledby={TOC_HEADING_ID}>
              <h2 id={TOC_HEADING_ID} className={styles.tocHeading}>On this page</h2>
              <ol className={styles.tocList}>
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a href={`#${heading.id}`} className={styles.tocLink}>{heading.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <article className={styles.article}>{children}</article>
        </div>

        <nav className={styles.related} aria-labelledby={RELATED_HEADING_ID}>
          <h2 id={RELATED_HEADING_ID} className={styles.relatedHeading}>Other policies</h2>
          <ul className={styles.relatedList}>
            {otherSlugs.map((other) => (
              <li key={other}>
                <Link href={LEGAL_DOCUMENT_PATHS[other]} className={styles.relatedLink}>
                  {LEGAL_DOCUMENT_LINK_LABELS[other]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  )
}
