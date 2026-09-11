'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/context/LanguageContext'
import { useTheme } from '@/context/ThemeContext'
import { useCurrency } from '@/context/CurrencyContext'
import type { CurrencyCode } from '@/lib/currency'
import type { TranslationKey } from '@/lib/translations'
import { tips } from '@/lib/tipsContent'
import {
  Menu, X, ArrowRight, Banknote, PieChart, Target, Bot, Mic, Landmark,
  CalendarDays, Users, BookOpen,
} from 'lucide-react'
import styles from './LandingPage.module.css'

// ─── Cutoff timeline amounts, per currency (no conversion) ──────────────────

const CUTOFF_AMOUNTS: Record<CurrencyCode, {
  income: string
  rent: string
  padala: string
  diningSpent: string
  diningCeiling: string
  left: string
  perDay: string
}> = {
  PHP: { income: '₱21,250', rent: '₱9,800',  padala: '₱3,000', diningSpent: '₱4,200', diningCeiling: '₱5,000', left: '₱4,250', perDay: '₱708'   },
  QAR: { income: '﷼2,900',  rent: '﷼1,340',  padala: '﷼410',   diningSpent: '﷼570',   diningCeiling: '﷼680',   left: '﷼580',   perDay: '﷼97'    },
  USD: { income: '$375',    rent: '$173',    padala: '$53',    diningSpent: '$74',    diningCeiling: '$88',    left: '$75',    perDay: '$12.50' },
}

// ─── Featured tips (Tagalog framing + first sentence of body) ───────────────

const FEATURED_TIP_IDS = ['tip-50-30-20', 'tip-13th-month', 'tip-gcash-maya-save']

function firstSentence(body: string): string {
  const idx = body.indexOf('. ')
  return idx === -1 ? body : `${body.slice(0, idx)}.`
}

// ─── Main Landing Page ───────────────────────────────────────────────────────

export default function LandingPage() {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const { currency } = useCurrency()
  const isDark = theme === 'dark'

  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [rowsIn, setRowsIn] = useState(false)
  const [howVisible, setHowVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const howRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    if (mq.matches) {
      setRowsIn(true)
      return
    }
    const id = setTimeout(() => setRowsIn(true), 150)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const el = howRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHowVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const amounts = CUTOFF_AMOUNTS[currency]

  const timelineRows: {
    labelKey: TranslationKey
    metaKey: TranslationKey
    amount: string
    dotVar: string
  }[] = [
    { labelKey: 'landing.timeline.row1.label', metaKey: 'landing.timeline.row1.meta', amount: `+${amounts.income}`, dotVar: 'var(--color-income)' },
    { labelKey: 'landing.timeline.row2.label', metaKey: 'landing.timeline.row2.meta', amount: `−${amounts.rent}`,   dotVar: 'var(--color-expense)' },
    { labelKey: 'landing.timeline.row3.label', metaKey: 'landing.timeline.row3.meta', amount: `−${amounts.padala}`, dotVar: 'var(--color-expense)' },
    { labelKey: 'landing.timeline.row4.label', metaKey: 'landing.timeline.row4.meta', amount: `${amounts.diningSpent} / ${amounts.diningCeiling}`, dotVar: 'var(--color-warning)' },
  ]

  const features: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    { icon: Banknote,  titleKey: 'landing.feat1.title', descKey: 'landing.feat1.desc' },
    { icon: PieChart,  titleKey: 'landing.feat2.title', descKey: 'landing.feat2.desc' },
    { icon: Target,    titleKey: 'landing.feat3.title', descKey: 'landing.feat3.desc' },
    { icon: Bot,       titleKey: 'landing.feat4.title', descKey: 'landing.feat4.desc' },
    { icon: Mic,       titleKey: 'landing.feat5.title', descKey: 'landing.feat5.desc' },
    { icon: Landmark,  titleKey: 'landing.feat6.title', descKey: 'landing.feat6.desc' },
  ]

  const filCards: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    { icon: CalendarDays, titleKey: 'landing.fil1.title', descKey: 'landing.fil1.desc' },
    { icon: Users,        titleKey: 'landing.fil2.title', descKey: 'landing.fil2.desc' },
    { icon: Banknote,     titleKey: 'landing.fil3.title', descKey: 'landing.fil3.desc' },
    { icon: BookOpen,     titleKey: 'landing.fil4.title', descKey: 'landing.fil4.desc' },
  ]

  const howSteps: { eyebrowKey: TranslationKey; titleKey: TranslationKey; descKey: TranslationKey; opacity: number }[] = [
    { eyebrowKey: 'landing.how.s1.eyebrow', titleKey: 'landing.how.s1.title', descKey: 'landing.how.s1.desc', opacity: 0.9 },
    { eyebrowKey: 'landing.how.s2.eyebrow', titleKey: 'landing.how.s2.title', descKey: 'landing.how.s2.desc', opacity: 0.6 },
    { eyebrowKey: 'landing.how.s3.eyebrow', titleKey: 'landing.how.s3.title', descKey: 'landing.how.s3.desc', opacity: 0.35 },
  ]

  const featuredTips = FEATURED_TIP_IDS
    .map(id => tips.find(tip => tip.id === id))
    .filter((tip): tip is NonNullable<typeof tip> => Boolean(tip))

  return (
    <div className={styles.page}>

      {/* ── NAV ───────────────────────────────────────────────────────── */}
      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image
            src={isDark ? '/logo-dark.png' : '/logo.png'}
            alt="WaiseKa"
            width={34}
            height={34}
            style={{ borderRadius: 10, objectFit: 'contain', flexShrink: 0 }}
          />
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
            WaiseKa
          </span>
        </div>

        <div className={styles.navLinks}>
          <a href="#features" className={styles.navLink}>{t('landing.nav.features')}</a>
          <a href="#how" className={styles.navLink}>{t('landing.nav.howItWorks')}</a>
          <a href="#tips" className={styles.navLink}>{t('landing.nav.tips')}</a>
        </div>

        <div className={styles.navControls}>
          <Link href="/login" className={styles.signInLink}>{t('landing.nav.signIn')}</Link>
          <Link href="/register" className={`${styles.btnGradient} ${styles.navGetStarted}`}>
            {t('landing.nav.getStarted')}
          </Link>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className={styles.menuTrigger}
            aria-label="Menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          <a href="#features" onClick={() => setMenuOpen(false)} className={styles.mobileMenuLink}>
            {t('landing.nav.features')}
          </a>
          <a href="#how" onClick={() => setMenuOpen(false)} className={styles.mobileMenuLink}>
            {t('landing.nav.howItWorks')}
          </a>
          <a href="#tips" onClick={() => setMenuOpen(false)} className={styles.mobileMenuLink}>
            {t('landing.nav.tips')}
          </a>
          <Link href="/login" onClick={() => setMenuOpen(false)} className={styles.mobileMenuLink}>
            {t('landing.nav.signIn')}
          </Link>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div>
            <div className={styles.heroBadge}>
              <span style={{ fontSize: 15 }}>🇵🇭</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '0.02em' }}>
                {t('landing.hero.badge')}
              </span>
            </div>

            <h1 className={styles.heroH1}>
              {t('landing.hero.headline1')}
              <br />
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>
                {t('landing.hero.headline2')}
              </em>
            </h1>

            <p className={styles.heroSub}>{t('landing.hero.sub')}</p>

            <div className={styles.heroCtas}>
              <Link href="/register" className={`${styles.btnGradient} ${styles.btnGradientLg}`}>
                {t('landing.hero.cta')}
                <ArrowRight size={15} />
              </Link>
            </div>

            <p className={styles.heroFine}>
              ✓ {t('landing.hero.fine1')} · {t('landing.hero.fine2')} · {t('landing.hero.fine3')}
            </p>
          </div>

          <div className={styles.timelineCard}>
            <div className={styles.timelineHeader}>
              <span className={styles.timelineEyebrow}>{t('landing.timeline.eyebrow')}</span>
              <span className={styles.timelineDay}>{t('landing.timeline.day')}</span>
            </div>

            <div>
              {timelineRows.map((row, i) => (
                <div
                  key={row.labelKey}
                  className={`${styles.timelineRow} ${rowsIn ? styles.timelineRowIn : ''}`}
                  style={reducedMotion ? undefined : { transitionDelay: `${i * 100}ms` }}
                >
                  <div className={styles.timelineDotCol}>
                    <span className={styles.timelineDot} style={{ background: row.dotVar }} />
                    {i < timelineRows.length - 1 && <span className={styles.timelineLine} />}
                  </div>
                  <div className={styles.timelineRowBody}>
                    <div>
                      <div className={styles.timelineLabel}>{t(row.labelKey)}</div>
                      <div className={styles.timelineMeta}>{t(row.metaKey)}</div>
                    </div>
                    <span className={styles.timelineAmount} style={{ color: row.dotVar }}>{row.amount}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.timelineFooter}>
              <div>
                <div className={styles.timelineEyebrow}>{t('landing.timeline.footer.eyebrow')}</div>
                <div className={styles.timelineFooterValue}>{amounts.left}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#ECF4EE' }}>
                  {t('landing.timeline.footer.daysLeft')}
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(235,244,238,0.5)', marginTop: 2 }}>
                  ≈ {amounts.perDay} / {t('landing.timeline.footer.perDay')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STAT BAND ─────────────────────────────────────────────────── */}
      <section className={styles.statBand}>
        {([
          { valueKey: 'landing.stat1.value', labelKey: 'landing.stat1.label', accent: true },
          { valueKey: 'landing.stat2.value', labelKey: 'landing.stat2.label', accent: false },
          { valueKey: 'landing.stat3.value', labelKey: 'landing.stat3.label', accent: false },
          { valueKey: 'landing.stat4.value', labelKey: 'landing.stat4.label', accent: false },
        ] as { valueKey: TranslationKey; labelKey: TranslationKey; accent: boolean }[]).map(stat => (
          <div key={stat.valueKey} className={styles.statCell}>
            <div
              className={styles.statValue}
              style={{ color: stat.accent ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
            >
              {t(stat.valueKey)}
            </div>
            <div className={styles.statLabel}>{t(stat.labelKey)}</div>
          </div>
        ))}
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <section id="features" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>
              {t('landing.features.title')}{' '}
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>{t('landing.features.titleEm')}</em>
            </h2>
            <p className={styles.sectionSub}>{t('landing.features.sub')}</p>
          </div>

          <div className={styles.featuresGrid}>
            {features.map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className={styles.featureCard}>
                <div className={styles.iconTile}>
                  <Icon size={16} color="var(--color-accent)" strokeWidth={2} />
                </div>
                <h3 className={styles.cardH3}>{t(titleKey)}</h3>
                <p className={styles.cardBody}>{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUILT FOR FILIPINOS ──────────────────────────────────────── */}
      <section className={styles.filBand}>
        <div className={styles.section} style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className={styles.filGrid}>
            <div>
              <h2 className={`${styles.h2} ${styles.h2Band}`}>
                {t('landing.fil.title')}{' '}
                <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>{t('landing.fil.titleEm')}</em>
              </h2>
              <p className={styles.sectionSubLeft}>{t('landing.fil.sub')}</p>
            </div>

            <div className={styles.filCardsGrid}>
              {filCards.map(({ icon: Icon, titleKey, descKey }) => (
                <div key={titleKey} className={styles.filCard}>
                  <div className={styles.filCardHead}>
                    <Icon size={18} color="var(--color-accent)" strokeWidth={2} />
                    <h3 className={styles.cardH3} style={{ margin: 0 }}>{t(titleKey)}</h3>
                  </div>
                  <p className={styles.cardBody}>{t(descKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section id="how" className={styles.section} ref={howRef}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>{t('landing.how.title')}</h2>
          </div>

          <div className={styles.howGrid}>
            {howSteps.map((step, i) => (
              <div key={step.eyebrowKey}>
                <div className={styles.howEyebrow}>{t(step.eyebrowKey)}</div>
                <div
                  className={`${styles.howRule} ${howVisible ? styles.howRuleIn : ''}`}
                  style={{
                    background: `rgba(74,222,128,${step.opacity})`,
                    ...(reducedMotion ? {} : { transitionDelay: `${i * 150}ms` }),
                  }}
                />
                <h3 className={styles.cardH3}>{t(step.titleKey)}</h3>
                <p className={styles.cardBody}>{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIPS & GABAY ─────────────────────────────────────────────── */}
      <section id="tips" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.tipsHead}>
            <h2 className={styles.h2} style={{ margin: 0 }}>
              {t('landing.tips.title')}{' '}
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>{t('landing.tips.titleEm')}</em>
            </h2>
            <Link href="/tips" className={styles.tipsReadAll}>{t('landing.tips.readAll')}</Link>
          </div>

          <div className={styles.tipsGrid}>
            {featuredTips.map(tip => (
              <div key={tip.id} className={styles.tipCard}>
                <h3 className={styles.cardH3}>{tip.title}</h3>
                <p className={styles.tipFraming}>{tip.filipinoFraming}</p>
                <p className={styles.cardBody}>{firstSentence(tip.body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className={styles.ctaBand}>
        <div className={`${styles.container} ${styles.ctaGrid}`}>
          <div className={styles.ctaCopy}>
            <h2 className={styles.h2} style={{ marginBottom: 10 }}>
              {t('landing.cta.title')}{' '}
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>{t('landing.cta.titleEm')}</em>
            </h2>
            <p className={styles.cardBody} style={{ fontSize: 15 }}>{t('landing.cta.sub')}</p>
          </div>
          <Link href="/register" className={`${styles.btnGradient} ${styles.btnGradientLg}`}>
            {t('landing.cta.button')}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image
            src={isDark ? '/logo-dark.png' : '/logo.png'}
            alt="WaiseKa"
            width={26}
            height={26}
            style={{ borderRadius: 8, objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>WaiseKa</span>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
              {t('landing.footer.tagline')}
            </p>
          </div>
        </div>

        <div className={styles.footerLinks}>
          <a href="#features" className={styles.footerLink}>{t('landing.footer.features')}</a>
          <a href="#tips" className={styles.footerLink}>{t('landing.footer.tips')}</a>
          <Link href="/privacy" className={styles.footerLink}>{t('landing.footer.privacy')}</Link>
          <span className={styles.footerRights}>© {new Date().getFullYear()} WaiseKa, {t('landing.footer.rights')}</span>
        </div>
      </footer>

    </div>
  )
}
