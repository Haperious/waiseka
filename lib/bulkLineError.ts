import type { TranslationKey } from '@/lib/translations'

/** Field name → message for one invalid line of the desktop Add Multiple table. */
export type RowErrors = Record<string, string>

/** "Line 2 needs a category before you can save." - one sentence per invalid line. */
export function lineErrorMessage(lineNumber: number, errors: RowErrors, t: (key: TranslationKey) => string): string {
  const needs = [errors.amount && t('bulkForm.anAmount'), errors.category && t('bulkForm.aCategory')].filter(Boolean)
  if (needs.length > 0) {
    return t('bulkForm.lineNeeds')
      .replace('{n}', String(lineNumber))
      .replace('{what}', needs.join(` ${t('bulkForm.and')} `))
  }
  return `${lineNumber}: ${Object.values(errors).join(', ')}`
}
