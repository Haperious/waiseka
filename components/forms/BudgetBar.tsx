import styles from './forms.module.css'

/**
 * Budget progress bar, matching the dashboard BudgetBar: green under 70%,
 * amber from 70%, red from 90%.
 */
export function BudgetBar({ name, color, spent, limit, formatAmount }: {
  name: string
  color?: string
  spent: number
  limit: number
  formatAmount: (v: number) => string
}) {
  const pct = limit > 0 ? (spent / limit) * 100 : 0
  const level = pct >= 90 ? 'expense' : pct >= 70 ? 'warning' : 'income'
  return (
    <div className={styles.bar}>
      <div className={styles.barHead}>
        <span className={styles.barName}>
          {color && <span className={styles.barDot} style={{ background: color }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </span>
        <span className={styles.barNums}>
          {formatAmount(spent)} / {limit > 0 ? formatAmount(limit) : '-'}
          {limit > 0 && (
            <span
              className={styles.barPct}
              style={{ background: `var(--color-${level}-bg)`, color: `var(--color-${level})` }}
            >
              {Math.round(pct)}%
            </span>
          )}
        </span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${Math.min(pct, 100)}%`, background: `var(--color-${level})` }}
        />
      </div>
    </div>
  )
}
