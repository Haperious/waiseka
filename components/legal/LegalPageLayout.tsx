import type { ReactNode } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { LayoutDashboard } from 'lucide-react'
import { legalTokens } from '@/lib/legal/config'
import { extractLegalHeadings, type LegalHeading } from '@/lib/legal/extractLegalHeadings'
import {
  LEGAL_DOCUMENT_DESCRIPTIONS,
  LEGAL_DOCUMENT_LINK_LABELS,
  LEGAL_DOCUMENT_PATHS,
  LEGAL_DOCUMENT_SHORT_LABELS,
  LEGAL_DOCUMENT_SLUGS,
  type LegalDocumentSlug,
} from '@/lib/legal/legalDocuments'
import type { LegalDocument, LegalGlanceItem } from '@/lib/legal/parseLegalDocument'
import { LEGAL_DOCUMENT_ICONS, LEGAL_GLANCE_ICONS } from './legalIcons'
import { WKIcon } from '@/components/ui/WKIcon'
import { LegalThemeToggle } from './LegalThemeToggle'
import { LegalToc } from './LegalToc'
import styles from './legal.module.css'

const EFFECTIVE_DATE_FORMAT = 'd MMMM yyyy'
const RELATED_HEADING_ID = 'legal-related-heading'
const APP_HOME_PATH = '/dashboard'

interface LegalPageLayoutProps {
  slug: LegalDocumentSlug
  document: LegalDocument
  /** The rendered body, normally <LegalMarkdown body={document.body} />. */
  children: ReactNode
}

/**
 * WK icon in both scopes, swapped by CSS so the right one shows before hydration.
 * Hidden from screen readers: the "WaiseKa" wordmark beside it already names the link.
 */
function Logo({ size }: { size: number }) {
  return (
    <span className={styles.logo} aria-hidden="true">
      <WKIcon size={size} scope="light" className={styles.logoLight} />
      <WKIcon size={size} scope="dark" className={styles.logoDark} />
    </span>
  )
}

function LegalHeader({ slug }: { slug: LegalDocumentSlug }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand}>
          <Logo size={32} />
          <span className={styles.wordmark}>WaiseKa</span>
        </Link>

        {/* Always shown on legal pages; LegalLinks stays gated for the rest of the site */}
        <nav aria-label="Legal documents" className={styles.segmented}>
          {LEGAL_DOCUMENT_SLUGS.map((other) => {
            const Icon = LEGAL_DOCUMENT_ICONS[other]
            const isCurrent = other === slug
            return (
              <Link
                key={other}
                href={LEGAL_DOCUMENT_PATHS[other]}
                className={isCurrent ? `${styles.segment} ${styles.segmentCurrent}` : styles.segment}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <Icon size={13} strokeWidth={2} aria-hidden />
                {LEGAL_DOCUMENT_SHORT_LABELS[other]}
              </Link>
            )
          })}
        </nav>

        <div className={styles.headerActions}>
          <LegalThemeToggle />
          <Link href={APP_HOME_PATH} className={styles.openButton} aria-label="Open WaiseKa">
            <LayoutDashboard size={14} strokeWidth={2} aria-hidden className={styles.openIcon} />
            <span className={styles.openLabel}>Open WaiseKa</span>
          </Link>
        </div>
      </div>
    </header>
  )
}

function GlanceCards({ items, headings }: { items: LegalGlanceItem[]; headings: LegalHeading[] }) {
  return (
    <ul className={styles.glance}>
      {items.map((item) => {
        const Icon = LEGAL_GLANCE_ICONS[item.icon]
        const target = item.section === undefined
          ? undefined
          : headings.find((heading) => heading.number === String(item.section))
        return (
          <li key={item.title} className={styles.glanceCard}>
            <span className={styles.glanceIcon} aria-hidden="true">
              <Icon size={16} strokeWidth={2} />
            </span>
            <p className={styles.glanceTitle}>{item.title}</p>
            {target && (
              <a href={`#${target.id}`} className={styles.glanceRef}>Section {item.section}</a>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function LegalHero({ slug, document, headings }: { slug: LegalDocumentSlug; document: LegalDocument; headings: LegalHeading[] }) {
  return (
    <section className={styles.hero} aria-labelledby="legal-title">
      <div className={`${styles.glow} ${styles.glowTop}`} aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glowBottom}`} aria-hidden="true" />

      <div className={styles.heroInner}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden="true" />
          <span>
            Legal · Version {document.version} · Effective{' '}
            <time dateTime={document.effectiveDate}>{format(parseISO(document.effectiveDate), EFFECTIVE_DATE_FORMAT)}</time>
          </span>
        </p>

        <h1 id="legal-title" className={styles.title}>
          {document.hero ? (
            <>
              {document.hero.title}
              {document.hero.emphasis && <> <em>{document.hero.emphasis}</em></>}
            </>
          ) : (
            document.title
          )}
        </h1>
        {document.titleTl && (
          <p className={styles.subtitle} lang="tl">{document.titleTl}</p>
        )}
        <p className={styles.lede}>{LEGAL_DOCUMENT_DESCRIPTIONS[slug]}</p>

        {document.glance && <GlanceCards items={document.glance} headings={headings} />}
      </div>
    </section>
  )
}

function PrivacyHelpBox() {
  const email = legalTokens.CONTACT_EMAIL
  return (
    <div className={styles.helpBox}>
      <p className={styles.helpTitle}>Privacy request?</p>
      <p className={styles.helpBody}>
        Email <a href={`mailto:${email}`}>{email}</a> with the subject &ldquo;Privacy request&rdquo;.
      </p>
    </div>
  )
}

function LegalFooter({ slug }: { slug: LegalDocumentSlug }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Link href="/" className={styles.footerBrand}>
          <Logo size={22} />
          WaiseKa
        </Link>

        <nav aria-labelledby={RELATED_HEADING_ID}>
          <h2 id={RELATED_HEADING_ID} className={styles.srOnly}>Other policies</h2>
          <ul className={styles.footerLinks}>
            {LEGAL_DOCUMENT_SLUGS.map((other) => (
              <li key={other}>
                <Link
                  href={LEGAL_DOCUMENT_PATHS[other]}
                  className={styles.footerLink}
                  aria-current={other === slug ? 'page' : undefined}
                >
                  {LEGAL_DOCUMENT_LINK_LABELS[other]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}

export function LegalPageLayout({ slug, document, children }: LegalPageLayoutProps) {
  const headings = extractLegalHeadings(document.body)

  return (
    <div className={styles.page}>
      <LegalHeader slug={slug} />

      <main>
        <LegalHero slug={slug} document={document} headings={headings} />

        <div className={headings.length > 0 ? styles.body : `${styles.body} ${styles.bodyNoToc}`}>
          {headings.length > 0 && (
            <LegalToc headings={headings} footer={slug === 'privacy' ? <PrivacyHelpBox /> : undefined} />
          )}
          <article className={styles.article}>{children}</article>
        </div>
      </main>

      <LegalFooter slug={slug} />
    </div>
  )
}
