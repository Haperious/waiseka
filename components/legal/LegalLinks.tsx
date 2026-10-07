import type { CSSProperties } from 'react'
import Link from 'next/link'
import {
  LEGAL_DOCUMENT_LINK_LABELS,
  LEGAL_DOCUMENT_PATHS,
  LEGAL_DOCUMENT_SHORT_LABELS,
  LEGAL_DOCUMENT_SLUGS,
} from '@/lib/legal/legalDocuments'
import { isLegalPagesPublic } from '@/lib/legal/visibility'

interface LegalLinksProps {
  /** `short`: Privacy / Terms / Security. `full`: Privacy Policy / Terms of Service / Security. */
  labels?: 'short' | 'full'
  className?: string
  style?: CSSProperties
  linkClassName?: string
  linkStyle?: CSSProperties
}

/**
 * Links to the three legal pages. Renders nothing until
 * NEXT_PUBLIC_LEGAL_PAGES_PUBLIC is 'true', so the pages stay unlinked during
 * legal review. No hooks - usable from server and client components.
 */
export function LegalLinks({ labels = 'short', className, style, linkClassName, linkStyle }: LegalLinksProps) {
  if (!isLegalPagesPublic()) return null

  const labelSet = labels === 'short' ? LEGAL_DOCUMENT_SHORT_LABELS : LEGAL_DOCUMENT_LINK_LABELS

  return (
    <nav aria-label="Legal" className={className} style={style}>
      {LEGAL_DOCUMENT_SLUGS.map((slug) => (
        <Link key={slug} href={LEGAL_DOCUMENT_PATHS[slug]} className={linkClassName} style={linkStyle}>
          {labelSet[slug]}
        </Link>
      ))}
    </nav>
  )
}
