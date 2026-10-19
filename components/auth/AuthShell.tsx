import type { ReactNode } from 'react'
import Link from 'next/link'
import { Activity, CalendarDays, Users } from 'lucide-react'
import { LegalLinks } from '@/components/legal/LegalLinks'
import { WKIcon } from '@/components/ui/WKIcon'
import styles from './auth.module.css'

interface AuthShellProps {
  /** Desktop-only element above the headline (e.g. the "Built for Filipino Workers" pill). */
  kicker?: ReactNode
  /** Playfair headline on the green panel, e.g. <>Your sweldo, <em>sorted.</em></> */
  headline: ReactNode
  /** Desktop-only panel content below the headline (pill, body, preview, perks). Hidden on mobile. */
  panel?: ReactNode
  /** Desktop-only line pinned to the bottom of the panel. */
  panelFooter?: ReactNode
  children: ReactNode
}

/**
 * Split-screen auth layout: green brand panel left, form column right.
 * On mobile the panel collapses into a header and the form sits on a sheet below it.
 */
export function AuthShell({ kicker, headline, panel, panelFooter, children }: AuthShellProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.panel}>
        <Link href="/" className={styles.brand}>
          <WKIcon size={34} scope="light" />
          <span className={styles.wordmark}>WaiseKa</span>
        </Link>
        <div className={styles.panelMain}>
          {kicker}
          <h1 className={styles.panelHeadline}>{headline}</h1>
          {panel}
        </div>
        {panelFooter ? <div className={styles.panelFooter}>{panelFooter}</div> : <div className={styles.desktopOnly} />}
      </aside>

      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
        <LegalLinks className={styles.mainFooter} />
      </main>
    </div>
  )
}

/** Static budget bar for the marketing preview card. Mirrors the dashboard BudgetBar look. */
function PreviewBar({ name, spent, limit }: { name: string; spent: number; limit: number }) {
  const pct = Math.min((spent / limit) * 100, 100)
  const color = pct >= 90 ? 'var(--color-expense)' : pct >= 70 ? 'var(--color-warning)' : 'var(--color-income)'
  const peso = (v: number) => `₱${v.toLocaleString('en-PH')}`
  return (
    <div className={styles.bar}>
      <div className={styles.barHead}>
        <span className={styles.barName}>{name}</span>
        <span className={styles.barNums}>
          {peso(spent)} / {peso(limit)}
        </span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function BuiltForPill() {
  return <span className={styles.pill}>🇵🇭 Built for Filipino Workers</span>
}

/** Login panel content: pitch and a static cutoff preview (user isn't signed in, so no data). */
export function LoginPanel() {
  return (
    <>
      <p className={styles.panelBody}>
        Track every cutoff, padala, and 13th month in one place. Free to start.
      </p>
      <div className={styles.preview} aria-hidden="true">
        <div className={styles.previewCol}>
          <span className={styles.eyebrow}>Oct 16–31 cutoff</span>
          <span className={styles.previewAmount}>₱8,240</span>
          <span className={styles.previewSub}>left to spend</span>
          <span className={styles.sagePill}>
            <CalendarDays size={12} />
            6 days to sweldo
          </span>
        </div>
        <div className={styles.previewCol}>
          <span className={styles.eyebrow}>Budgets this cutoff</span>
          <PreviewBar name="Food & Pulutan" spent={3850} limit={5000} />
          <PreviewBar name="Load & Internet" spent={460} limit={500} />
        </div>
      </div>
    </>
  )
}

const REGISTER_PERKS = [
  { Icon: CalendarDays, title: 'Built around cutoffs', body: 'Plan each sweldo on the 15th and 30th, not just the month.' },
  { Icon: Users, title: 'Padala, tracked', body: 'See exactly how much goes home every cutoff.' },
  { Icon: Activity, title: 'Pera Health Score', body: 'One number from 0 to 100 for how this month is going.' },
]

/** Register panel content: three perks. */
export function RegisterPanel() {
  return (
    <ul className={styles.perks} style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
      {REGISTER_PERKS.map(({ Icon, title, body }) => (
        <li key={title} className={styles.perk}>
          <span className={styles.perkIcon}>
            <Icon size={16} />
          </span>
          <div>
            <div className={styles.perkTitle}>{title}</div>
            <div className={styles.perkBody}>{body}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}
