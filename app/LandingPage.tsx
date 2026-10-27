'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight, Bot, ChevronRight, Menu, Mic, Moon, MoveHorizontal, Sun, Wallet, X,
} from 'lucide-react'
import { WKIcon } from '@/components/ui/WKIcon'
import { LegalLinks } from '@/components/legal/LegalLinks'
import { useLanguage } from '@/context/LanguageContext'
import { useTheme } from '@/context/ThemeContext'
import styles from './LandingPage.module.css'

// ─── Cutoff ribbon demo (static, PHP only) ──────────────────────────────────

const DEMO = { symbol: '₱', income: 21250, rent: 9800, padala: 3000, dining: 4200, ceil: 5000, left: 4250 }
const CUTOFF_DAYS = 15
const DEFAULT_DAY = 9
const START_DATE = 15 // Sep 15

function fmt(value: number): string {
  return (value < 0 ? '−' : '') + DEMO.symbol + Math.round(Math.abs(value)).toLocaleString('en-US')
}

const sepDate = (day: number) => `Sep ${START_DATE - 1 + day}`

/** Figures for a given day of the cutoff. Day 9 lands exactly on DEMO.left. */
function cutoffAt(day: number) {
  const varSpend = ((DEMO.income - DEMO.rent - DEMO.padala - DEMO.left) * day) / DEFAULT_DAY
  const left = DEMO.income - (day >= 2 ? DEMO.rent : 0) - (day >= 3 ? DEMO.padala : 0) - varSpend
  const daysLeft = CUTOFF_DAYS - day
  return {
    left,
    daysLeft,
    perDay: daysLeft > 0 ? left / daysLeft : left,
    dining: Math.min((DEMO.dining * day) / DEFAULT_DAY, DEMO.ceil),
  }
}

/** Event markers on the track: position and the day they appear from. */
const MARKERS = [
  { pct: 0, color: 'var(--color-income)', from: 1 },
  { pct: 7.14, color: 'var(--color-expense)', from: 2 },
  { pct: 14.28, color: 'var(--color-expense)', from: 3 },
  { pct: 57.14, color: 'var(--color-warning)', from: 9 },
]

const WAVE_BARS = 14
const WAVE_BARS_MOBILE = 10
const SWELDO_CELLS = 13
const SWELDOS_SAVED = 3

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { t } = useLanguage()
  const { toggleTheme } = useTheme()
  const [day, setDay] = useState(DEFAULT_DAY)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const { left, daysLeft, perDay, dining } = cutoffAt(day)
  const opacityFrom = (from: number) => (day >= from ? 1 : 0.3)
  const daysLeftLabel =
    daysLeft === 0 ? t('landing.ribbon.nextSweldo')
    : daysLeft === 1 ? t('landing.ribbon.daysLeftOne')
    : t('landing.ribbon.daysLeft').replace('{n}', String(daysLeft))

  const tiles = [
    { meta: t('landing.ribbon.row1.meta'), label: t('landing.ribbon.row1.label'), amount: `+${fmt(DEMO.income)}`, color: 'var(--color-income)', from: 1 },
    { meta: t('landing.ribbon.row2.meta'), label: t('landing.ribbon.row2.label'), amount: fmt(-DEMO.rent), color: 'var(--color-expense)', from: 2 },
    { meta: t('landing.ribbon.row3.meta'), label: t('landing.ribbon.row3.label'), amount: fmt(-DEMO.padala), color: 'var(--color-expense)', from: 3 },
    { meta: t('landing.ribbon.row4.meta'), label: t('landing.ribbon.row4.label'), amount: `${fmt(dining)} / ${fmt(DEMO.ceil)}`, color: 'var(--color-warning)', from: 9, warn: true },
  ]

  const stats = [
    { value: t('landing.stat1.value'), label: t('landing.stat1.label'), accent: true },
    { value: t('landing.stat2.value'), label: t('landing.stat2.label') },
    { value: t('landing.stat3.value'), label: t('landing.stat3.label') },
    { value: t('landing.stat4.value'), label: t('landing.stat4.label') },
  ]

  const accounts = [
    { name: t('landing.accounts.row1'), value: '₱67,900', stripe: 'var(--color-income)' },
    { name: t('landing.accounts.row2'), value: '−₱2,200', stripe: 'var(--color-warning)', negative: true },
    { name: t('landing.accounts.row3'), value: '₱150', stripe: 'var(--color-income)' },
  ]

  const navLinks = [
    { href: '#features', label: t('landing.nav.features') },
    { href: '#whats-new', label: t('landing.nav.whatsNew') },
    { href: '#how', label: t('landing.nav.howItWorks') },
    { href: '/tips', label: t('landing.nav.tips') },
  ]

  const [answerBefore, answerAfter] = t('landing.ai.answer').split('{left}')

  const logo = (
    <span aria-hidden="true">
      <span className={`${styles.logoMark} ${styles.onLight}`}><WKIcon size={32} scope="light" /></span>
      <span className={`${styles.logoMark} ${styles.onDark}`}><WKIcon size={32} scope="dark" /></span>
    </span>
  )

  return (
    <div className={styles.page}>

      {/* ── 1. NAV ────────────────────────────────────────────────────── */}
      <header className={styles.navBar}>
        <nav className={`${styles.shell} ${styles.nav}`}>
          <Link href="/" className={styles.logo}>
            {logo}
            <span className={styles.logoText}>WaiseKa</span>
          </Link>

          <div className={styles.navLinks}>
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className={styles.link}>{l.label}</Link>
            ))}
          </div>

          <div className={styles.navRight}>
            <button
              type="button"
              onClick={toggleTheme}
              className={`${styles.iconBtn} ${styles.themeBtn}`}
              aria-label={t('landing.nav.toggleTheme')}
            >
              <Moon className={styles.onLight} />
              <Sun className={styles.onDark} />
            </button>
            <Link href="/login" className={`${styles.link} ${styles.signIn}`}>{t('landing.nav.signIn')}</Link>
            <Link href="/register" className={`${styles.cta} ${styles.navCta}`}>{t('landing.nav.getStarted')}</Link>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={`${styles.iconBtn} ${styles.menuBtn}`}
              aria-label={menuOpen ? t('landing.nav.closeMenu') : t('landing.nav.menu')}
              aria-expanded={menuOpen}
              aria-controls="landing-menu"
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div id="landing-menu" className={styles.drawer}>
            {[...navLinks, { href: '/login', label: t('landing.nav.signIn') }].map((l) => (
              <Link key={l.href} href={l.href} className={styles.drawerLink} onClick={() => setMenuOpen(false)}>
                {l.label}
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        )}
      </header>

      <main>
        {/* ── 2. HERO + 3. CUTOFF RIBBON ──────────────────────────────── */}
        <section className={styles.hero}>
          <div className={styles.glows} aria-hidden="true">
            <div className={`${styles.glow} ${styles.glowTop}`} />
            <div className={`${styles.glow} ${styles.glowBottom}`} />
          </div>

          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div>
                <div className={styles.badge}>
                  <span className={styles.badgeFlag} aria-hidden="true">🇵🇭</span>
                  <span className={styles.badgeText}>{t('landing.hero.badge')}</span>
                </div>
                <h1 className={styles.h1}>
                  {t('landing.hero.headline1')}{' '}
                  <br className={styles.h1Break} />
                  <em className={styles.accentEm}>{t('landing.hero.headline2')}</em>
                </h1>
              </div>

              <div className={styles.heroAside}>
                <p className={styles.heroSub}>{t('landing.hero.sub')}</p>
                <Link href="/register" className={`${styles.cta} ${styles.heroCta}`}>
                  {t('landing.hero.cta')}
                  <ArrowRight size={15} />
                </Link>
                <p className={styles.heroFine}>
                  ✓ {t('landing.hero.fine1')} · {t('landing.hero.fine2')} · {t('landing.hero.fine3')}
                </p>
              </div>
            </div>

            <div id="how" className={styles.ribbon}>
              <div className={styles.hint} aria-hidden="true">
                <MoveHorizontal />
                {t('landing.ribbon.hint')}
              </div>

              <div className={styles.ribbonHead}>
                <div>
                  <div className={styles.ribbonEyebrow}>
                    {t('landing.ribbon.eyebrow').replace('{day}', String(day))}
                  </div>
                  <div className={styles.amountRow}>
                    <span className={styles.amount}>{fmt(left)}</span>
                    <span className={styles.amountLabel}>{t('landing.ribbon.left')}</span>
                  </div>
                </div>
                <div className={styles.perDayBlock}>
                  <span className={styles.perDay}>
                    ≈ {fmt(perDay)}
                    <span className={styles.perDayUnit}> {t('landing.ribbon.perDay')}</span>
                  </span>
                  <span className={styles.daysLeft}>{daysLeftLabel}</span>
                </div>
              </div>

              <div className={styles.trackWrap}>
                <div className={styles.track}>
                  <div className={styles.fill} style={{ width: `${((day - 1) / (CUTOFF_DAYS - 1)) * 100}%` }} />
                  {MARKERS.map((m) => (
                    <span
                      key={m.pct}
                      className={styles.marker}
                      style={{ left: `${m.pct}%`, background: m.color, opacity: opacityFrom(m.from) }}
                    />
                  ))}
                </div>
                <input
                  type="range"
                  min={1}
                  max={CUTOFF_DAYS}
                  step={1}
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className={styles.range}
                  aria-label={t('landing.ribbon.slider')}
                  aria-valuetext={t('landing.ribbon.sliderValue')
                    .replace('{day}', String(day))
                    .replace('{date}', sepDate(day))
                    .replace('{left}', fmt(left))}
                />

                <div className={styles.ticks} aria-hidden="true">
                  {Array.from({ length: CUTOFF_DAYS }, (_, i) => (
                    <span key={i}>{i === 0 || i === CUTOFF_DAYS - 1 || i + 1 === day ? sepDate(i + 1) : i + 1}</span>
                  ))}
                </div>
                <div className={styles.ticksMobile} aria-hidden="true">
                  <span>{sepDate(1)}</span>
                  <span className={styles.ticksCurrent}>
                    {t('landing.ribbon.dayLabel').replace('{day}', String(day)).replace('{date}', sepDate(day))}
                  </span>
                  <span>{sepDate(CUTOFF_DAYS)}</span>
                </div>
              </div>

              <div className={styles.tiles}>
                {tiles.map((tile) => (
                  <div
                    key={tile.label}
                    className={`${styles.tile} ${tile.warn ? styles.tileWarn : ''}`}
                    style={{ opacity: opacityFrom(tile.from) }}
                  >
                    <div className={styles.tileMeta}>{tile.meta}</div>
                    <div className={styles.tileRow}>
                      <span>{tile.label}</span>
                      <span className={styles.tileAmount} style={{ color: tile.color }}>{tile.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. STAT STRIP ───────────────────────────────────────────── */}
        <div className={styles.shell}>
          <section className={styles.stats}>
            {stats.map((s) => (
              <div key={s.value} className={styles.stat}>
                <div className={`${styles.statValue} ${s.accent ? styles.statAccent : ''}`}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </section>
        </div>

        {/* ── 5. FEATURE BENTO ────────────────────────────────────────── */}
        <section id="features" className={`${styles.shell} ${styles.features}`}>
          <div className={styles.featuresHead}>
            <h2 className={styles.h2}>
              {t('landing.features.title')}{' '}
              <br className={styles.h2Break} />
              <em className={styles.accentEm}>{t('landing.features.titleEm')}</em>
            </h2>
            <p className={styles.featuresSub}>{t('landing.features.sub')}</p>
          </div>

          <div className={styles.bento}>
            {/* A: Log expenses faster */}
            <article id="whats-new" className={`${styles.card} ${styles.cardFaster} ${styles.lift}`}>
              <div className={styles.fasterText}>
                <span className={styles.newTag}>{t('landing.features.new')}</span>
                <h3 className={styles.fasterH3}>{t('landing.faster.title')}</h3>
                <p className={styles.fasterBody}>{t('landing.faster.desc')}</p>
              </div>
              <Image
                src="/landing/faster-adding.png"
                alt={t('landing.faster.alt')}
                width={1200}
                height={675}
                sizes="(min-width: 1024px) 800px, 100vw"
                className={styles.fasterImg}
              />
            </article>

            {/* B: Every account in one view */}
            <article className={`${styles.card} ${styles.cardB} ${styles.lift}`}>
              <div className={styles.cardHead}>
                <span className={styles.eyebrow}>{t('landing.accounts.eyebrow')}</span>
                <Wallet size={16} color="var(--color-accent)" aria-hidden="true" />
              </div>
              <div className={styles.totalMoney}>₱65,850.00</div>
              <div className={styles.accounts}>
                {accounts.map((a) => (
                  <div key={a.name} className={styles.account} style={{ '--stripe': a.stripe } as React.CSSProperties}>
                    <span className={styles.accountName}>{a.name}</span>
                    <span className={styles.accountValue} style={a.negative ? { color: 'var(--color-expense)' } : undefined}>
                      {a.value}
                    </span>
                  </div>
                ))}
              </div>
              <h3 className={styles.cardH3}>{t('landing.accounts.title')}</h3>
              <p className={styles.cardBody}>{t('landing.accounts.desc')}</p>
            </article>

            {/* C: Budgets and goals */}
            <article className={`${styles.card} ${styles.cardGoals} ${styles.lift}`}>
              <span className={styles.newTag}>{t('landing.features.new')}</span>
              <div className={styles.goalName}>{t('landing.goals.goal')}</div>
              <div className={styles.goalAmountRow}>
                <span className={styles.goalAmount}>₱2,350</span>
                <span className={styles.goalUnit}>{t('landing.goals.perCutoff')}</span>
              </div>
              <div className={styles.sweldoCells} aria-hidden="true">
                {Array.from({ length: SWELDO_CELLS }, (_, i) => (
                  <span key={i} className={`${styles.sweldoCell} ${i < SWELDOS_SAVED ? styles.sweldoCellDone : ''}`} />
                ))}
              </div>
              <div className={styles.sweldoCaption}>{t('landing.goals.sweldos')}</div>
              <h3 className={styles.cardH3}>{t('landing.goals.title')}</h3>
              <p className={styles.cardBody}>{t('landing.goals.desc')}</p>
            </article>

            {/* D: AI coach */}
            <article className={`${styles.card} ${styles.cardStack}`}>
              <div className={styles.stackHead}>
                <span className={styles.iconTile}><Bot size={16} aria-hidden="true" /></span>
                <h3 className={styles.cardH3}>{t('landing.ai.title')}</h3>
              </div>
              <div className={styles.bubbleUser}>{t('landing.ai.question')}</div>
              <div className={styles.bubbleBot}>
                {answerBefore}<b>{fmt(DEMO.left)}</b>{answerAfter}
              </div>
            </article>

            {/* E: Voice & PDF import */}
            <article className={`${styles.card} ${styles.cardStack}`}>
              <div className={styles.stackHead}>
                <span className={styles.iconTile}><Mic size={16} aria-hidden="true" /></span>
                <h3 className={styles.cardH3}>{t('landing.voice.title')}</h3>
              </div>
              <div className={styles.voiceRow}>
                <div className={styles.wave} aria-hidden="true">
                  {Array.from({ length: WAVE_BARS }, (_, i) => (
                    <span
                      key={i}
                      className={`${styles.waveBar} ${i >= WAVE_BARS_MOBILE ? styles.waveExtra : ''}`}
                      style={{ '--dur': `${0.9 + (i % 4) * 0.15}s`, '--delay': `${i * 0.07}s` } as React.CSSProperties}
                    />
                  ))}
                </div>
                <div className={styles.voicePhrase}>{t('landing.voice.phrase')}</div>
                <span className={styles.voiceAmount}>−₱320</span>
              </div>
              <p className={styles.cardBody}>{t('landing.voice.desc')}</p>
            </article>
          </div>
        </section>

        {/* ── 6. CLOSING CTA ──────────────────────────────────────────── */}
        <div className={`${styles.shell} ${styles.closingWrap}`}>
          <section className={styles.closing}>
            <div className={styles.closingGlow} aria-hidden="true" />
            <h2 className={styles.closingH2}>
              {t('landing.cta.title')}{' '}
              <em className={styles.accentEm}>{t('landing.cta.titleEm')}</em>
            </h2>
            <p className={styles.closingSub}>{t('landing.cta.sub')}</p>
            <Link href="/register" className={`${styles.cta} ${styles.closingCta}`}>
              {t('landing.cta.button')}
              <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      </main>

      {/* ── 7. FOOTER ─────────────────────────────────────────────────── */}
      <footer className={styles.footerBar}>
        <div className={`${styles.shell} ${styles.footer}`}>
          <Link href="/" className={`${styles.logo} ${styles.footerLogo}`}>
            {logo}
            <span className={styles.logoText}>WaiseKa</span>
          </Link>
          <div className={styles.footerRight}>
            <div className={styles.footerLinks}>
              <Link href="#features" className={styles.link}>{t('landing.footer.features')}</Link>
              <Link href="/tips" className={styles.link}>{t('landing.footer.tips')}</Link>
              <LegalLinks className={styles.legalLinks} linkClassName={styles.link} />
            </div>
            <span>© {new Date().getFullYear()} WaiseKa</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
