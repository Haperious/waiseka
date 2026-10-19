import {
  Ban,
  BellRing,
  FileText,
  FileX,
  KeyRound,
  Lock,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import type { LegalGlanceIconName } from '@/lib/legal/parseLegalDocument'
import type { LegalDocumentSlug } from '@/lib/legal/legalDocuments'

/** Icons glance cards can name in frontmatter. Keyed by the allow-list parseLegalDocument validates against. */
export const LEGAL_GLANCE_ICONS: Record<LegalGlanceIconName, LucideIcon> = {
  Ban,
  BellRing,
  FileText,
  FileX,
  KeyRound,
  Lock,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
}

/** Icon beside each document in the header nav. */
export const LEGAL_DOCUMENT_ICONS: Record<LegalDocumentSlug, LucideIcon> = {
  privacy: Lock,
  terms: FileText,
  security: Shield,
}
