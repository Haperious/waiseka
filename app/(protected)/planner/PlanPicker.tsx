'use client'

import { CalendarRange, Check, ChevronDown, Lock, Plus } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { formatDay } from '@/lib/planner/days'
import type { PlannerScenarioListItem } from '@/lib/planner/types'
import { useMenu } from './useMenu'
import styles from './planner.module.css'

interface PlanPickerProps {
  scenarios: PlannerScenarioListItem[]
  selectedId: string | null
  /** The open plan's live name and end date (may be ahead of the list while saving). */
  name: string
  endDate: string
  today: string
  /** "2 of 3", shown inside the button on mobile. Null when there's no limit. */
  usageShort: string | null
  atLimit: boolean
  isDesktop: boolean
  onChoose: (id: string) => void
  onNew: () => void
}

/** The plan switcher: a popover on desktop, a bottom sheet on mobile. */
export default function PlanPicker({
  scenarios, selectedId, name, endDate, today, usageShort, atLimit, isDesktop, onChoose, onNew,
}: PlanPickerProps) {
  const { t } = useLanguage()
  const { open, toggle, close, triggerRef, menuRef, onMenuKeyDown } = useMenu<HTMLButtonElement>()
  const range = endDate < today
    ? t('planner.planEnded').replace('{date}', formatDay(endDate, today))
    : t('planner.todayTo').replace('{date}', formatDay(endDate, today))

  const list = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t('planner.yourPlans')}
      className={isDesktop ? `${styles.menu} ${styles.pickerMenu}` : styles.pickerSheet}
      onKeyDown={onMenuKeyDown}
    >
      {!isDesktop && <div aria-hidden className={styles.sheetHandle} />}
      {scenarios.map((s) => {
        const on = s._id === selectedId
        return (
          <button
            key={s._id}
            type="button"
            role="menuitemradio"
            aria-checked={on}
            className={`${styles.pickerItem} ${on ? styles.pickerItemOn : ''}`}
            onClick={() => {
              close()
              if (!on) onChoose(s._id)
            }}
          >
            <span className={styles.pickerItemText}>
              <span className={styles.pickerItemName}>{on ? name : s.name}</span>
              <span className={styles.pickerItemMeta}>
                {t('planner.planEnds').replace('{date}', formatDay(on ? endDate : s.endDate, today))}
                {' · '}
                {s.itemCount === 1 ? t('planner.itemCountOne') : t('planner.itemCount').replace('{n}', String(s.itemCount))}
              </span>
            </span>
            {on && <Check aria-hidden size={15} />}
          </button>
        )
      })}
      <div role="separator" className={styles.menuDivider} />
      <button
        type="button"
        role="menuitem"
        disabled={atLimit}
        title={atLimit ? t('planner.limitReached') : undefined}
        className={styles.menuItem}
        onClick={() => {
          close(false)
          onNew()
        }}
      >
        {atLimit ? <Lock aria-hidden size={15} /> : <Plus aria-hidden size={15} />}
        <span>{atLimit ? t('planner.limitReached') : t('planner.newPlan')}</span>
      </button>
    </div>
  )

  return (
    <div className={styles.popWrap} style={isDesktop ? undefined : { flex: 1, minWidth: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.picker}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('planner.choosePlan')}: ${name}`}
        onClick={toggle}
      >
        <CalendarRange aria-hidden size={15} style={{ flexShrink: 0 }} />
        <span className={styles.pickerName}>{name}</span>
        {isDesktop ? (
          <span className={styles.pickerRange}>{range}</span>
        ) : (
          usageShort && <span className={styles.pickerUsage}>{usageShort}</span>
        )}
        <ChevronDown aria-hidden size={14} style={{ flexShrink: 0 }} />
      </button>
      {open && (
        isDesktop ? list : (
          <>
            <div aria-hidden className={styles.sheetBackdrop} onClick={() => close()} />
            {list}
          </>
        )
      )}
    </div>
  )
}
