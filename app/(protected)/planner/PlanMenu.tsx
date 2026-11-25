'use client'

import { CalendarPlus, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { useMenu } from './useMenu'
import styles from './planner.module.css'

interface PlanMenuProps {
  /** Duplicate and Carry over make a new plan, so they're off at the limit or mid-request. */
  createDisabled: boolean
  limitReached: boolean
  onEdit: () => void
  onDuplicate: () => void
  onCarryOver: () => void
  onDelete: () => void
}

/** The ⋯ menu with the open plan's actions. */
export default function PlanMenu({ createDisabled, limitReached, onEdit, onDuplicate, onCarryOver, onDelete }: PlanMenuProps) {
  const { t } = useLanguage()
  const { open, toggle, close, triggerRef, menuRef, onMenuKeyDown } = useMenu<HTMLButtonElement>()
  const run = (fn: () => void) => () => {
    close(false)
    fn()
  }
  const limitTitle = limitReached ? t('planner.limitReached') : undefined

  return (
    <div className={styles.popWrap}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.iconTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('planner.planActions')}
        onClick={toggle}
      >
        <MoreHorizontal aria-hidden size={18} />
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label={t('planner.planActions')} className={`${styles.menu} ${styles.actionsMenu}`} onKeyDown={onMenuKeyDown}>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={run(onEdit)}>
            <Pencil aria-hidden size={15} /><span>{t('planner.editPlan')}</span>
          </button>
          <button type="button" role="menuitem" className={styles.menuItem} disabled={createDisabled} title={limitTitle} onClick={run(onDuplicate)}>
            <Copy aria-hidden size={15} /><span>{t('planner.duplicate')}</span>
          </button>
          <button type="button" role="menuitem" className={styles.menuItem} disabled={createDisabled} title={limitTitle} onClick={run(onCarryOver)}>
            <CalendarPlus aria-hidden size={15} /><span>{t('planner.carryOver')}</span>
          </button>
          <div role="separator" className={styles.menuDivider} />
          <button type="button" role="menuitem" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={run(onDelete)}>
            <Trash2 aria-hidden size={15} /><span>{t('planner.deletePlan')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
