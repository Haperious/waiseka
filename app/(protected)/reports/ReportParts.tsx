'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { CalendarDays, Crown, Lightbulb } from 'lucide-react'
import { FREE_HISTORY_DAYS, PREMIUM_HISTORY_DAYS } from '@/lib/constants'
import { TONE_BG, TONE_COLOR, type Tone } from './reportModel'
import styles from './reports.module.css'

/* Building blocks shared by the 3-month, full-year and year-on-year reports. */

// ── Bar chart ─────────────────────────────────────────────────────────────────

export interface ChartBar {
  value: number
  color: string
  /** Shown above the bar; `compactLabel` replaces it on phones in the 3-month chart. */
  label: string
  compactLabel?: string
  opacity?: number
}

export interface ChartColumn {
  key: string
  xLabel: string
  xLabelColor: string
  /** null draws a dashed placeholder (a month that hasn't happened yet). */
  bars: ChartBar[] | null
}

const MIN_BAR_PCT = 2
/** Tallest bar's share of the track, leaving room for its value label. */
const MAX_BAR_PCT = 82

export function barHeight(value: number, max: number): string {
  return `${Math.max(MIN_BAR_PCT, (value / Math.max(1, max)) * MAX_BAR_PCT)}%`
}

/**
 * Grouped bar chart. `quarter` is the 3-month chart (horizontal value labels, rotated
 * on phones); `year` and `yoy` always rotate them and scroll sideways on phones.
 */
export function BarChart({ columns, variant, ariaLabel }: {
  columns: ChartColumn[]
  variant: 'quarter' | 'year' | 'yoy'
  ariaLabel: string
}) {
  const max = Math.max(1, ...columns.flatMap((c) => c.bars?.map((b) => b.value) ?? []))
  const rotated = variant !== 'quarter'
  return (
    <div className={styles.chartScroll}>
      <div className={`${styles.track} ${styles[variant]}`} role="img" aria-label={ariaLabel}>
        {columns.map((col) => (
          <div key={col.key} className={styles.col}>
            {col.bars ? (
              <div className={styles.bars}>
                {col.bars.map((bar, i) => (
                  <div key={i} className={styles.barSlot}>
                    <span
                      className={`${styles.valueLabel} ${rotated ? styles.vertical : styles.fullOnly}`}
                      aria-hidden
                    >
                      {bar.label}
                    </span>
                    {!rotated && (
                      <span className={`${styles.valueLabel} ${styles.vertical} ${styles.compactOnly}`} aria-hidden>
                        {bar.compactLabel ?? bar.label}
                      </span>
                    )}
                    <div
                      className={styles.bar}
                      style={{ height: barHeight(bar.value, max), backgroundColor: bar.color, opacity: bar.opacity }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.placeholderSlot}>
                <div className={styles.placeholder} />
              </div>
            )}
            <span className={styles.xLabel} style={{ color: col.xLabelColor }}>{col.xLabel}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export function CardHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className={styles.cardHead}>
      <p className={styles.cardTitle}>{title}</p>
      {note && <span className={styles.cardNote}>{note}</span>}
    </div>
  )
}

export interface ShareItem {
  name: string
  color: string
  amount: number
}

/** Stacked share bar plus the top-6 list, for "Where {month|year} went". */
export function WhereItWent({ title, note, items, formatAmount }: {
  title: string
  note?: string
  items: ShareItem[]
  formatAmount: (v: number) => string
}) {
  const total = items.reduce((s, c) => s + c.amount, 0) || 1
  const top = [...items].sort((a, b) => b.amount - a.amount).slice(0, 6)
  return (
    <div className={`${styles.card} ${styles.cardPad}`} style={{ gap: 12 }}>
      <CardHead title={title} note={note} />
      <div className={styles.shareBar}>
        {top.map((c) => (
          <div key={c.name} style={{ width: `${(c.amount / total) * 100}%`, backgroundColor: c.color }} />
        ))}
      </div>
      {top.length === 0 ? (
        <p className={styles.bodyNote}>No spending recorded.</p>
      ) : (
        <ul className={styles.legendList}>
          {top.map((c) => (
            <li key={c.name} className={styles.legendRow}>
              <span className={styles.dot} style={{ backgroundColor: c.color }} />
              <span className={styles.rowName}>{c.name}</span>
              <span className={styles.rowAmount}>{formatAmount(c.amount)}</span>
              <span className={styles.rowPct}>{Math.round((c.amount / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Summary stat tiles ────────────────────────────────────────────────────────

export interface StatTile {
  label: string
  value: string
  color: string
  badge?: { text: string; tone: Tone } | null
  previous?: string
}

export function StatTiles({ tiles, footnote }: { tiles: StatTile[]; footnote?: string }) {
  return (
    <div className={styles.statsBlock}>
      <div className={styles.stats}>
        {tiles.map((t) => (
          <div key={t.label} className={styles.stat}>
            <div className={styles.statHead}>
              <span className={styles.statLabel}>{t.label}</span>
              {t.badge && (
                <span className={styles.badge} style={{ color: TONE_COLOR[t.badge.tone], backgroundColor: TONE_BG[t.badge.tone] }}>
                  {t.badge.text}
                </span>
              )}
            </div>
            <span className={styles.statValue} style={{ color: t.color }}>{t.value}</span>
            {t.previous && <span className={styles.statPrev}>{t.previous}</span>}
          </div>
        ))}
      </div>
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </div>
  )
}

// ── Category panel ────────────────────────────────────────────────────────────

export function CategoryPanel({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.panelHead}>
        <p className={styles.panelTitle}>{title}</p>
        {caption && <span className={styles.cardNote}>{caption}</span>}
      </div>
      {children}
      <div className={styles.tip}>
        <Lightbulb size={15} aria-hidden />
        <p className={styles.secondaryText} style={{ fontSize: '0.78rem' }}>
          Recurring obligations are the amount you can&apos;t move month to month. Everything else in your
          category breakdown is where you have room to cut.
        </p>
      </div>
    </section>
  )
}

export interface SparkBar {
  height: string
  color: string
}

export function CategoryTile({ name, amount, note, noteColor, bars, barWidth, barGap }: {
  name: string
  amount: string
  note: string
  noteColor?: string
  bars: SparkBar[]
  barWidth: number
  barGap: number
}) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileText}>
        <p className={styles.tileName} title={name}>{name}</p>
        <p className={styles.tileLine}>
          <span className={styles.tileAmount}>{amount}</span>{' '}
          <span style={{ color: noteColor ?? 'var(--color-text-muted)' }}>{note}</span>
        </p>
      </div>
      <div className={styles.spark} style={{ '--spark-w': `${barWidth}px`, '--spark-gap': `${barGap}px` } as CSSProperties} aria-hidden>
        {bars.map((b, i) => (
          <div key={i} className={styles.sparkBar} style={{ height: b.height, backgroundColor: b.color }} />
        ))}
      </div>
    </div>
  )
}

export function CategoryTiles({ children }: { children: ReactNode }) {
  return <div className={styles.tiles}>{children}</div>
}

// ── States ────────────────────────────────────────────────────────────────────

export function PremiumLockCard() {
  return (
    <div className={`${styles.premiumCard} ${styles.lockCard}`} role="status">
      <div className={styles.premiumIcon} style={{ width: 32, height: 32, borderRadius: 9 }}>
        <Crown size={16} aria-hidden />
      </div>
      <div className={styles.lockText}>
        <p className={styles.lockTitle}>Full-year and year-on-year reports are part of Premium</p>
        <p className={styles.secondaryText}>
          See every month of the year and compare it with the last — up to {Math.round(PREMIUM_HISTORY_DAYS / 365)} years of history.
        </p>
      </div>
      <Link href="/premium" className={styles.upgradeButton}>Upgrade</Link>
    </div>
  )
}

export function EmptyYearCard({ year, firstYearWithData }: { year: number; firstYearWithData: number | null }) {
  let body: string
  if (firstYearWithData === null) body = 'Add a transaction and your report will show up here.'
  else if (firstYearWithData > year) body = `Your history starts in ${firstYearWithData}. Pick another year from the menu to see its report.`
  else body = 'Pick another year from the menu to see its report.'
  return (
    <div className={`${styles.card} ${styles.emptyCard}`}>
      <div className={styles.emptyIcon}><CalendarDays size={24} aria-hidden /></div>
      <p className={styles.emptyTitle}>No transactions in {year}</p>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  )
}

export function ReportError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className={`${styles.card} ${styles.emptyCard}`} role="alert">
      <p className={styles.emptyTitle}>Couldn&apos;t load this report</p>
      {message && <p className={styles.emptyBody}>{message}</p>}
      <button type="button" className={styles.retryButton} onClick={onRetry}>Try again</button>
    </div>
  )
}

export function PlanFooter({ premium }: { premium: boolean }) {
  const freeYears = Math.round(FREE_HISTORY_DAYS / 365)
  const premiumYears = Math.round(PREMIUM_HISTORY_DAYS / 365)
  return (
    <div className={`${styles.premiumCard} ${styles.footerCard}`}>
      <div className={styles.premiumIcon} style={{ width: 28, height: 28, borderRadius: 8 }}>
        <Crown size={14} aria-hidden />
      </div>
      <p className={styles.secondaryText} style={{ flex: 1 }}>
        {premium ? (
          <>Your plan keeps the last <strong>{premiumYears} years</strong>.</>
        ) : (
          <>
            Your plan keeps the last <strong>{freeYears} years</strong>. Premium keeps {premiumYears} years and
            adds full-year and year-on-year views.
          </>
        )}
      </p>
    </div>
  )
}
