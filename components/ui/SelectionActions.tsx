'use client'

import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'
import styles from './selection-actions.module.css'

export interface SelectionAction {
  key: string
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  icon?: LucideIcon
  /** Desktop bar shows only the icon, with the label as its aria-label. */
  iconOnly?: boolean
  loading?: boolean
  /** Sheet only: takes a full row above the grid. */
  fullWidth?: boolean
}

interface SelectionActionsProps {
  open: boolean
  title: string
  subtitle?: string
  /** Shown before the title in the desktop bar (a dot, for example). */
  leading?: React.ReactNode
  /** Shown before the title in the mobile sheet (an icon tile, for example). */
  sheetLeading?: React.ReactNode
  /** Desktop bar actions, in order. */
  actions: SelectionAction[]
  /** Sheet actions when they differ from the bar's (order, variants, handlers). */
  sheetActions?: SelectionAction[]
  /** Columns of the sheet's action grid. */
  mobileColumns?: 2 | 3
  /**
   * Where the desktop bar sits: `absolute` inside a positioned page that doesn't scroll,
   * or `sticky` at the end of a scrolling page so it stays in view.
   */
  barPlacement?: 'absolute' | 'sticky'
  /** Pauses the Escape handler while a modal opened from here is on top. */
  escapeDisabled?: boolean
  onClose: () => void
}

/**
 * What can be done with the selected thing: a floating bar on desktop, a bottom sheet
 * on mobile. Escape, the close button and the sheet's backdrop all clear the selection.
 */
export default function SelectionActions({
  open, title, subtitle, leading, sheetLeading, actions, sheetActions, mobileColumns = 2,
  barPlacement = 'absolute', escapeDisabled, onClose,
}: SelectionActionsProps) {
  const { t } = useLanguage()

  useEffect(() => {
    if (!open || escapeDisabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, escapeDisabled, onClose])

  if (!open) return null

  const sheet = sheetActions ?? actions
  const lead = sheet.filter((a) => a.fullWidth)
  const grid = sheet.filter((a) => !a.fullWidth)

  return (
    <>
      <div
        role="region"
        aria-label={title}
        className={`${styles.bar} ${barPlacement === 'sticky' ? styles.barSticky : styles.barAbsolute}`}
      >
        {leading}
        <div className={styles.barInfo}>
          <span className={styles.barName}>{title}</span>
          {subtitle && <span className={styles.barSub}>{subtitle}</span>}
        </div>
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <Button
              key={a.key}
              variant={a.variant ?? 'secondary'}
              size="sm"
              loading={a.loading}
              onClick={a.onClick}
              aria-label={a.iconOnly ? a.label : undefined}
              title={a.iconOnly ? a.label : undefined}
              className={a.iconOnly ? styles.iconOnly : undefined}
              style={a.iconOnly && a.variant === 'danger' ? { backgroundColor: 'transparent', color: 'var(--color-expense)' } : undefined}
            >
              {Icon && <Icon aria-hidden size={a.iconOnly ? 16 : 14} style={a.iconOnly ? undefined : { marginRight: 4 }} />}
              {!a.iconOnly && a.label}
            </Button>
          )
        })}
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className={`${styles.iconButton} ${styles.barClose}`}
        >
          <X style={{ width: 15, height: 15 }} />
        </button>
      </div>

      <div aria-hidden className={styles.backdrop} onClick={onClose} />
      <div role="dialog" aria-label={title} className={styles.sheet}>
        <div aria-hidden className={styles.handle} />
        <div className={styles.sheetInfo}>
          {sheetLeading}
          <div className={styles.sheetText}>
            <span className={styles.sheetName}>{title}</span>
            {subtitle && <span className={styles.sheetSub}>{subtitle}</span>}
          </div>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className={`${styles.iconButton} ${styles.sheetClose}`}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        {lead.map((a) => (
          <Button key={a.key} variant={a.variant ?? 'primary'} loading={a.loading} onClick={a.onClick} className={styles.sheetButton}>
            {a.label}
          </Button>
        ))}
        {grid.length > 0 && (
          <div className={styles.sheetActions} style={{ gridTemplateColumns: `repeat(${mobileColumns}, minmax(0, 1fr))` }}>
            {grid.map((a) => (
              <Button key={a.key} variant={a.variant ?? 'secondary'} loading={a.loading} onClick={a.onClick} className={styles.sheetButton}>
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
