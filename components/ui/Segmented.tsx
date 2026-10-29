'use client'

import { useRef } from 'react'
import styles from './segmented.module.css'

export interface SegmentedOption {
  value: string
  /** A node so callers can swap label text per breakpoint with CSS. */
  label: React.ReactNode
  /** Text colour of the segment while it's active. Defaults to primary text. */
  color?: string
}

interface SegmentedProps {
  options: SegmentedOption[]
  value: string
  onChange: (v: string) => void
  ariaLabel?: string
  style?: React.CSSProperties
  className?: string
}

/** Segmented control (radio group). Arrow keys move between segments, like native radios. */
export default function Segmented({ options, value, onChange, ariaLabel, style, className }: SegmentedProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={className ? `${styles.track} ${className}` : styles.track}
      style={style}
    >
      {options.map((opt, i) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={styles.segment}
            style={opt.color ? ({ '--seg-color': opt.color } as React.CSSProperties) : undefined}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
