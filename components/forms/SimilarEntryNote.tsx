'use client'

import { format } from 'date-fns'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount } from '@/lib/currency'
import type { SimilarEntry } from '@/hooks/useSimilarEntries'
import formStyles from '@/components/forms/forms.module.css'

/** Soft "already logged?" warning under a form. Renders nothing when there's no match. */
export default function SimilarEntryNote({ matches, currency }: { matches: SimilarEntry[]; currency: string }) {
  const { t } = useLanguage()
  if (matches.length === 0) return null
  const first = matches[0]
  const name = first.description || first.category
  // Function replacers, so "$&" and friends in a note are shown as typed
  const text = t('form.similar')
    .replace('{amount}', () => formatAmount(first.amount, currency))
    .replace('{date}', () => format(new Date(first.date), 'MMM d'))
    .replace('{name}', () => name)
  return (
    <div className={formStyles.warningBlock} role="status">
      {text}
    </div>
  )
}
