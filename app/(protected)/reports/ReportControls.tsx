'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Crown } from 'lucide-react'
import type { AvailableYear } from '@/lib/services/yearReport'
import { RANGES, type ReportRange } from './reportModel'
import styles from './reports.module.css'

/**
 * Last 3 months · Full year · Year-on-year. A free user can press the Premium ranges
 * (that shows the upgrade card) but they're dimmed and never shown as selected.
 */
export function RangeSwitcher({ value, premium, onChange }: {
  value: ReportRange
  premium: boolean
  onChange: (range: ReportRange) => void
}) {
  return (
    <div className={`${styles.segmented} ${styles.rangeSwitch}`} role="group" aria-label="Report range">
      {RANGES.map((r) => {
        const locked = r.premium && !premium
        return (
          <button
            key={r.value}
            type="button"
            className={styles.segment}
            aria-pressed={!locked && value === r.value}
            data-locked={locked || undefined}
            title={locked ? 'Premium feature' : undefined}
            onClick={() => onChange(r.value)}
          >
            {r.premium && <Crown size={11} color="#D97706" aria-hidden />}
            {r.label}
            {locked && <span className={styles.srOnly}> (Premium)</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Year dropdown for the Premium ranges. Years without data stay selectable (they show the empty state). */
export function YearPicker({ value, years, currentYear, onChange }: {
  value: number
  years: AvailableYear[]
  currentYear: number
  onChange: (year: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const openList = () => {
    setActiveIndex(Math.max(0, years.findIndex((y) => y.year === value)))
    setOpen(true)
  }

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) buttonRef.current?.focus()
  }

  const choose = (year: number) => {
    close(true)
    if (year !== value) onChange(year)
  }

  // Focus the list when it opens so arrow keys work straight away
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  // Click outside closes
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(years.length - 1, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(0, i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(years.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (years[activeIndex]) choose(years[activeIndex].year)
        break
      case 'Escape':
        e.preventDefault()
        close(true)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  const optionId = (year: number) => `${listId}-${year}`

  return (
    <div className={styles.yearPicker} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.yearButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Year: ${value}`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            openList()
          }
        }}
      >
        {value}
        <ChevronDown size={13} color="var(--color-text-muted)" aria-hidden />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Year"
          tabIndex={-1}
          className={styles.yearList}
          aria-activedescendant={years[activeIndex] ? optionId(years[activeIndex].year) : undefined}
          onKeyDown={onListKeyDown}
        >
          {years.map((y, i) => {
            const note = y.year === currentYear ? 'so far' : y.hasData ? '' : 'empty'
            return (
              <li
                key={y.year}
                id={optionId(y.year)}
                role="option"
                aria-selected={y.year === value}
                data-empty={!y.hasData || undefined}
                className={styles.yearOption}
                style={i === activeIndex && y.year !== value ? { background: 'var(--color-elevated)' } : undefined}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(y.year)}
              >
                {y.year}
                {note && <span className={styles.yearNote}>{note}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
