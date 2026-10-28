'use client'

import { Suspense, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  ChartPie,
  ChevronRight,
  Coins,
  CreditCard,
  HandHeart,
  Layers,
  PiggyBank,
  Receipt,
  RefreshCw,
  Shield,
  Smartphone,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'
import { tips, tipTopics, type Tip } from '@/lib/tipsContent'
import styles from './tips.module.css'

const TIP_ICONS: Record<Tip['iconKey'], LucideIcon> = {
  pie: ChartPie,
  piggy: PiggyBank,
  autoTransfer: RefreshCw,
  shield: Shield,
  calendar: CalendarDays,
  receipt: Receipt,
  subscriptionAudit: CreditCard,
  lifestyleInflation: TrendingUp,
  walletSave: Smartphone,
  cutoff: CalendarRange,
  installments: Layers,
  padala: HandHeart,
  sinkingFund: Coins,
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-secondary)',
}

const mono = "'DM Mono', monospace"

/** True when a key press belongs to a text field, so arrow keys and j/k should not change tips. */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

function TipsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  // A missing or unknown ?tip= shows the first tip (desktop) or the list (mobile)
  const requested = tips.findIndex((item) => item.id === searchParams.get('tip'))
  const hasTip = requested !== -1
  const activeIndex = hasTip ? requested : 0
  const tip = tips[activeIndex]
  const Icon = TIP_ICONS[tip.iconKey]
  const titleId = `${tip.id}-title`
  const isFirst = activeIndex === 0
  const isLast = activeIndex === tips.length - 1

  const listRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const focusTitleNext = useRef(false)
  const lastViewed = useRef<string | null>(null)

  const goTo = useCallback(
    (index: number, viaKeyboard = false) => {
      const next = tips[index]
      if (!next || (hasTip && index === activeIndex)) return
      focusTitleNext.current = viaKeyboard
      router.push(`/tips?tip=${next.id}`, { scroll: false })
    },
    [router, hasTip, activeIndex],
  )

  const showList = useCallback(() => router.push('/tips', { scroll: false }), [router])

  // ← / → and j / k step through tips
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (isTypingTarget(e.target) || document.querySelector('[aria-modal="true"]')) return
      const delta = e.key === 'ArrowRight' || e.key === 'j' ? 1 : e.key === 'ArrowLeft' || e.key === 'k' ? -1 : 0
      if (!delta) return
      const next = activeIndex + delta
      if (next < 0 || next >= tips.length) return
      e.preventDefault()
      goTo(next, true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, goTo])

  // On every tip change: read from the top, keep the list row in view, and move focus for keyboard users
  useEffect(() => {
    const main = scrollRef.current?.closest('main')
    if (hasTip) {
      scrollRef.current?.scrollTo({ top: 0 })
      main?.scrollTo({ top: 0 })
      listRef.current?.querySelector(`[data-tip="${tip.id}"]`)?.scrollIntoView({ block: 'nearest' })
      lastViewed.current = tip.id
    } else if (lastViewed.current) {
      // Back on the mobile list: return to the tip the user just read
      listRef.current?.querySelector(`[data-tip="${lastViewed.current}"]`)?.scrollIntoView({ block: 'center' })
    }
    if (focusTitleNext.current) {
      focusTitleNext.current = false
      titleRef.current?.focus({ preventScroll: true })
    }
  }, [tip.id, hasTip])

  return (
    <div className={styles.page} data-view={hasTip ? 'reader' : 'list'}>
      <header className={styles.header}>
        <h1
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontWeight: 900,
            fontSize: '1.6rem',
            lineHeight: 1.1,
            color: 'var(--color-text-primary)',
            marginBottom: 6,
          }}
        >
          {t('nav.tips')}
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          {t('tips.subtitle')}
        </p>
      </header>

      <div className={styles.panes}>
        {/* ── Tip list ── */}
        <nav ref={listRef} aria-label={t('tips.listLabel')} className={`${styles.list} ${styles.scroll}`}>
          {tips.map((item, i) => (
            <button
              key={item.id}
              type="button"
              data-tip={item.id}
              className={styles.row}
              aria-current={i === activeIndex ? 'true' : undefined}
              onClick={() => goTo(i)}
            >
              <span className={styles.rowNumber}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{item.title}</span>
                <span className={styles.rowFraming}>{item.filipinoFraming}</span>
              </span>
              <ChevronRight className={styles.rowChevron} size={18} strokeWidth={2} aria-hidden />
            </button>
          ))}
        </nav>

        {/* ── Reader ── */}
        <article className={styles.reader} aria-labelledby={titleId}>
          <button type="button" className={styles.backRow} onClick={showList}>
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            {t('tips.allTips')}
          </button>

          <div ref={scrollRef} className={`${styles.readerScroll} ${styles.scroll}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 9,
                  backgroundColor: 'var(--color-sage)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={20} strokeWidth={2} aria-hidden />
              </div>
              <p style={eyebrowStyle}>
                {tipTopics[tip.topic]} ·{' '}
                {t('tips.position').replace('{n}', String(activeIndex + 1)).replace('{total}', String(tips.length))}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
                {tip.title}
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-playfair), Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: '1.1rem',
                  lineHeight: 1.4,
                  color: 'var(--color-accent)',
                }}
              >
                {tip.filipinoFraming}
              </p>
            </div>

            <p
              style={{
                fontSize: '1rem',
                lineHeight: 1.75,
                color: 'var(--color-text-primary)',
                maxWidth: '62ch',
                textWrap: 'pretty',
              }}
            >
              {tip.body}
            </p>

            <section aria-labelledby={`${tip.id}-steps`}>
              <h3 id={`${tip.id}-steps`} style={{ ...eyebrowStyle, marginBottom: 14 }}>
                {t('tips.tryThis')}
              </h3>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {tip.steps.map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: 14, maxWidth: '62ch' }}>
                    <span
                      aria-hidden
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-sage)',
                        color: 'var(--color-accent)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: '0.93rem', lineHeight: 1.6, color: 'var(--color-text-primary)', paddingTop: 2 }}>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {tip.cta && (
              <Link href={tip.cta.route} className={styles.cta}>
                <span>{tip.cta.label}</span>
                <span aria-hidden style={{ fontFamily: mono }}>→</span>
              </Link>
            )}
          </div>

          <div className={styles.footer}>
            <Button variant="ghost" size="sm" disabled={isFirst} onClick={() => goTo(activeIndex - 1)}>
              <span aria-hidden style={{ marginRight: 6 }}>←</span>
              {t('tips.previous')}
            </Button>
            <span style={{ fontFamily: mono, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {activeIndex + 1} / {tips.length}
            </span>
            <Button variant="secondary" size="sm" disabled={isLast} onClick={() => goTo(activeIndex + 1)}>
              {t('tips.next')}
              <span aria-hidden style={{ marginLeft: 6 }}>→</span>
            </Button>
          </div>
        </article>
      </div>
    </div>
  )
}

export default function TipsPage() {
  // useSearchParams needs a Suspense boundary so the rest of the route can prerender
  return (
    <Suspense fallback={null}>
      <TipsView />
    </Suspense>
  )
}
