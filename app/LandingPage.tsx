'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/context/LanguageContext'
import { useTheme } from '@/context/ThemeContext'
import { useCurrency } from '@/context/CurrencyContext'
import type { CurrencyCode } from '@/lib/currency'
import type { TranslationKey } from '@/lib/translations'
import {
  Sun, Moon, Menu, X, TrendingUp, Target, MessageSquare,
  BarChart2, Tags, Zap, ArrowRight, Banknote, Users, PiggyBank,
  CalendarDays, ChevronDown, Mic, FileText, Crown,
} from 'lucide-react'

// ─── Preview amounts per currency ────────────────────────────────────────────

const PREVIEW_AMOUNTS: Record<CurrencyCode, { income: string; expense: string }> = {
  PHP: { income: '₱42,500', expense: '₱31,200' },
  QAR: { income: '﷼5,800',  expense: '﷼4,250'  },
  USD: { income: '$750',    expense: '$550'     },
}

// ─── Dashboard Preview Card ──────────────────────────────────────────────────

function DashboardPreview({ t, isDark }: { t: (k: TranslationKey) => string; isDark: boolean }) {
  const { currency } = useCurrency()
  const preview = PREVIEW_AMOUNTS[currency]
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 500)
    return () => clearTimeout(id)
  }, [])

  const R = 42
  const circ = 2 * Math.PI * R
  const score = 74
  const offset = mounted ? circ * (1 - score / 100) : circ

  const bars: { label: string; inc: number; exp: number }[] = [
    { label: 'Jun', inc: 72, exp: 58 },
    { label: 'Jul', inc: 85, exp: 62 },
    { label: 'Aug', inc: 68, exp: 52 },
    { label: 'Sep', inc: 91, exp: 71 },
    { label: 'Oct', inc: 80, exp: 57 },
  ]

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #0C100E 0%, #111C14 55%, #162018 100%)',
        borderRadius: 22,
        border: '1px solid rgba(74,222,128,0.18)',
        padding: 24,
        boxShadow: '0 32px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(74,222,128,0.1)',
        color: '#ECF4EE',
        width: '100%',
        maxWidth: 420,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* glow */}
      <div
        style={{
          position: 'absolute', top: -80, right: -80,
          width: 240, height: 240,
          background: 'radial-gradient(circle, rgba(74,222,128,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image
            src={isDark ? '/logo-dark.png' : '/logo.png'}
            alt="WaiseKa"
            width={28}
            height={28}
            style={{ borderRadius: 8, objectFit: 'contain' }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>WaiseKa</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['#FF5F57', '#FFBD2E', '#28C840'] as const).map(c => (
            <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
          ))}
        </div>
      </div>

      {/* score + stat row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {/* ring */}
        <div
          style={{
            background: 'rgba(74,222,128,0.07)', borderRadius: 14,
            padding: '12px 14px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', minWidth: 92,
          }}
        >
          <svg width="80" height="80" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
            <circle
              cx="50" cy="50" r={R} fill="none"
              stroke="#4ADE80" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              style={{
                transformOrigin: 'center', transform: 'rotate(-90deg)',
                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34,1.1,0.64,1)',
              }}
            />
            <text x="50" y="48" textAnchor="middle" fontSize="18" fontWeight="800" fill="#ECF4EE">
              {score}
            </text>
            <text x="50" y="63" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#4ADE80" letterSpacing="0.1">
              SCORE
            </text>
          </svg>
          <span style={{ fontSize: 10, color: '#4ADE80', fontWeight: 700, marginTop: 4, letterSpacing: '0.03em' }}>
            {t('dashboard.healthy')}
          </span>
        </div>

        {/* mini stats */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {([
            { label: t('landing.preview.income'),  val: preview.income,  color: '#4ADE80' },
            { label: t('landing.preview.expense'), val: preview.expense, color: '#F87171' },
            { label: t('landing.preview.rate'),    val: '26.6%',   color: '#34D399' },
          ]).map(({ label, val, color }) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 10,
                borderLeft: `2.5px solid ${color}`,
                padding: '7px 11px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 10, color: 'rgba(235,244,238,0.5)', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* mini bar chart */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '13px 11px' }}>
        <div
          style={{
            fontSize: 9, color: 'rgba(235,244,238,0.4)',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
          }}
        >
          {t('dashboard.incomeVsExpenses')}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 50 }}>
          {bars.map(({ label, inc, exp }, i) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 42 }}>
                <div
                  style={{
                    flex: 1, borderRadius: '3px 3px 0 0',
                    background: 'rgba(74,222,128,0.65)',
                    height: mounted ? `${inc * 0.43}px` : '0px',
                    transition: `height 0.9s cubic-bezier(0.34,1.1,0.64,1) ${0.5 + i * 0.07}s`,
                  }}
                />
                <div
                  style={{
                    flex: 1, borderRadius: '3px 3px 0 0',
                    background: 'rgba(248,113,113,0.65)',
                    height: mounted ? `${exp * 0.43}px` : '0px',
                    transition: `height 0.9s cubic-bezier(0.34,1.1,0.64,1) ${0.57 + i * 0.07}s`,
                  }}
                />
              </div>
              <span style={{ fontSize: 8, color: 'rgba(235,244,238,0.4)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Animated stat counter (IntersectionObserver) ────────────────────────────

function useCounter(target: number, duration = 1800) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const startTime = performance.now()
          const step = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * target))
            if (progress < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.5 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])

  return { count, ref }
}

// ─── Main Landing Page ───────────────────────────────────────────────────────

const CURRENCY_OPTIONS: { code: CurrencyCode; label: string; flag: string }[] = [
  { code: 'PHP', label: 'PHP', flag: '🇵🇭' },
  { code: 'QAR', label: 'QAR', flag: '🇶🇦' },
  { code: 'USD', label: 'USD', flag: '🇺🇸' },
]

export default function LandingPage() {
  const { language, setLanguage, t } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { currency, setCurrency } = useCurrency()
  const [menuOpen, setMenuOpen]       = useState(false)
  const [scrolled, setScrolled]       = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!currencyOpen) return
    const close = () => setCurrencyOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [currencyOpen])

  const isDark = theme === 'dark'

  const features: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey; color: string; badge?: 'premium' | 'new' }[] = [
    { icon: Banknote,      titleKey: 'landing.f1.title', descKey: 'landing.f1.desc', color: '#166534' },
    { icon: BarChart2,     titleKey: 'landing.f2.title', descKey: 'landing.f2.desc', color: '#16A34A' },
    { icon: Target,        titleKey: 'landing.f3.title', descKey: 'landing.f3.desc', color: '#15803D' },
    { icon: Crown,         titleKey: 'landing.f4.title', descKey: 'landing.f4.desc', color: '#D97706', badge: 'premium' },
    { icon: Mic,           titleKey: 'landing.f7.title', descKey: 'landing.f7.desc', color: '#16A34A', badge: 'new' },
    { icon: FileText,      titleKey: 'landing.f8.title', descKey: 'landing.f8.desc', color: '#15803D', badge: 'new' },
    { icon: TrendingUp,    titleKey: 'landing.f5.title', descKey: 'landing.f5.desc', color: '#16A34A' },
    { icon: Tags,          titleKey: 'landing.f6.title', descKey: 'landing.f6.desc', color: '#15803D' },
  ]

  const filipinoFeatures: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    { icon: CalendarDays, titleKey: 'landing.fil.13.title',    descKey: 'landing.fil.13.desc'    },
    { icon: Banknote,     titleKey: 'landing.fil.peso.title',  descKey: 'landing.fil.peso.desc'  },
    { icon: Users,        titleKey: 'landing.fil.fam.title',   descKey: 'landing.fil.fam.desc'   },
  ]

  const steps: { icon: React.ElementType; numKey: TranslationKey; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    { icon: Zap,        numKey: 'landing.how.s1.num', titleKey: 'landing.how.s1.title', descKey: 'landing.how.s1.desc' },
    { icon: TrendingUp, numKey: 'landing.how.s2.num', titleKey: 'landing.how.s2.title', descKey: 'landing.how.s2.desc' },
    { icon: PiggyBank,  numKey: 'landing.how.s3.num', titleKey: 'landing.how.s3.title', descKey: 'landing.how.s3.desc' },
  ]

  // ── Shared hover handlers ────────────────────────────────────────────────
  const cardHoverIn  = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform  = 'translateY(-3px)'
    e.currentTarget.style.boxShadow  = isDark
      ? '0 12px 40px rgba(0,0,0,0.4)'
      : '0 12px 40px rgba(0,0,0,0.1)'
  }
  const cardHoverOut = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform  = 'translateY(0)'
    e.currentTarget.style.boxShadow  = 'none'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text-primary)', overflowX: 'hidden' }}>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          height: 64, padding: '0 clamp(16px, 4vw, 64px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
          background: scrolled
            ? isDark ? 'rgba(12,16,14,0.88)' : 'rgba(247,246,240,0.92)'
            : 'transparent',
          borderBottom: `1px solid ${scrolled ? 'var(--color-border)' : 'transparent'}`,
          transition: 'background 0.3s, border-color 0.3s',
        }}
      >
        {/* Logo */}
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

        {/* Desktop links */}
        <div
          style={{ display: 'flex', gap: 32, alignItems: 'center' }}
          className="hidden md:flex"
        >
          {([
            { href: '#features', labelKey: 'landing.nav.features'   as TranslationKey },
            { href: '#how',      labelKey: 'landing.nav.howItWorks' as TranslationKey },
          ]).map(({ href, labelKey }) => (
            <a
              key={href} href={href}
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
            >
              {t(labelKey)}
            </a>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Currency selector — hidden on mobile */}
          <div className="hidden sm:block" style={{ position: 'relative' }}>
            <button
              onClick={() => setCurrencyOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--color-elevated)',
                border: '1px solid var(--color-border)',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                color: 'var(--color-accent)',
              }}
            >
              {CURRENCY_OPTIONS.find(c => c.code === currency)?.flag}{' '}
              {currency}
              <ChevronDown size={11} style={{ opacity: 0.6, marginLeft: 1 }} />
            </button>
            {currencyOpen && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10, overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  minWidth: 130,
                }}
              >
                {CURRENCY_OPTIONS.map(({ code, label, flag }) => (
                  <button
                    key={code}
                    onClick={() => { setCurrency(code); setCurrencyOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '9px 14px',
                      background: currency === code ? 'var(--color-elevated)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 13, fontWeight: currency === code ? 700 : 500,
                      color: currency === code ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                    onMouseEnter={e => { if (currency !== code) e.currentTarget.style.background = 'var(--color-elevated)' }}
                    onMouseLeave={e => { if (currency !== code) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 15 }}>{flag}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* EN / TL — hidden on mobile, shown sm+ */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'tl' : 'en')}
            className="hidden sm:flex"
            style={{
              alignItems: 'center', gap: 2,
              padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--color-elevated)',
              border: '1px solid var(--color-border)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            }}
          >
            <span style={{ color: language === 'en' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>EN</span>
            <span style={{ color: 'var(--color-text-muted)', margin: '0 2px' }}>·</span>
            <span style={{ color: language === 'tl' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>TL</span>
          </button>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            style={{
              padding: 7, borderRadius: 8, cursor: 'pointer',
              background: 'transparent', border: 'none', display: 'flex',
              color: 'var(--color-text-secondary)',
            }}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Sign In — hidden on mobile */}
          <Link
            href="/login"
            style={{
              padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              color: 'var(--color-text-secondary)', textDecoration: 'none',
              border: '1px solid var(--color-border)', transition: 'all 0.2s',
            }}
            className="hidden sm:block"
          >
            {t('landing.nav.signIn')}
          </Link>

          {/* Get Started — hidden on mobile */}
          <Link
            href="/register"
            style={{
              padding: '7px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: 'var(--color-accent)',
              color: isDark ? '#0C100E' : '#fff',
              textDecoration: 'none',
              boxShadow: '0 2px 10px rgba(22,163,74,0.3)', transition: 'all 0.2s',
            }}
            className="hidden sm:block"
          >
            {t('landing.nav.getStarted')}
          </Link>

          {/* Mobile hamburger — visible only on mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              padding: 7, borderRadius: 8, background: menuOpen ? 'var(--color-elevated)' : 'transparent',
              border: '1px solid ' + (menuOpen ? 'var(--color-border)' : 'transparent'),
              cursor: 'pointer', display: 'flex',
              color: 'var(--color-text-secondary)',
            }}
            className="sm:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed', top: 64, left: 0, right: 0, zIndex: 49,
            background: isDark ? '#111C14' : '#FAFAF5',
            borderBottom: '1px solid var(--color-border)',
            padding: '20px 24px 28px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}
        >
          {/* Nav links */}
          <a href="#features" onClick={() => setMenuOpen(false)} style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', textDecoration: 'none' }}>
            {t('landing.nav.features')}
          </a>
          <a href="#how" onClick={() => setMenuOpen(false)} style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', textDecoration: 'none' }}>
            {t('landing.nav.howItWorks')}
          </a>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--color-border)' }} />

          {/* Currency selector row */}
          <div style={{ display: 'flex', gap: 8 }}>
            {CURRENCY_OPTIONS.map(({ code, flag, label }) => (
              <button
                key={code}
                onClick={() => setCurrency(code)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: currency === code ? 'var(--color-elevated)' : 'transparent',
                  border: `1px solid ${currency === code ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  fontSize: 12, fontWeight: currency === code ? 700 : 500,
                  color: currency === code ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}
              >
                <span style={{ fontSize: 14 }}>{flag}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Utility row: EN/TL + theme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setLanguage(language === 'en' ? 'tl' : 'en')}
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--color-elevated)',
                border: '1px solid var(--color-border)',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
              }}
            >
              <span style={{ color: language === 'en' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>EN</span>
              <span style={{ color: 'var(--color-text-muted)', margin: '0 3px' }}>·</span>
              <span style={{ color: language === 'tl' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>TL</span>
            </button>
            <button
              onClick={toggleTheme}
              style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600,
              }}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              {isDark ? 'Light' : 'Dark'}
            </button>
          </div>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              style={{
                flex: 1, textAlign: 'center', padding: '11px', borderRadius: 10,
                border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600,
                color: 'var(--color-text-primary)', textDecoration: 'none',
              }}
            >
              {t('landing.nav.signIn')}
            </Link>
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              style={{
                flex: 1, textAlign: 'center', padding: '11px', borderRadius: 10,
                background: 'var(--color-accent)', fontSize: 14, fontWeight: 700,
                color: isDark ? '#0C100E' : '#fff', textDecoration: 'none',
              }}
            >
              {t('landing.nav.getStarted')}
            </Link>
          </div>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative', overflow: 'hidden',
          padding: 'clamp(56px, 8vw, 100px) clamp(16px, 5vw, 64px)',
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 'clamp(28px, 5vw, 48px)', flexWrap: 'wrap',
        }}
      >
        {/* BG radial */}
        <div
          style={{
            position: 'absolute', top: -120, left: -80, width: 560, height: 560,
            background: isDark
              ? 'radial-gradient(circle, rgba(74,222,128,0.06) 0%, transparent 65%)'
              : 'radial-gradient(circle, rgba(22,101,52,0.07) 0%, transparent 65%)',
            pointerEvents: 'none', zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute', bottom: -60, right: -40, width: 300, height: 300,
            background: isDark
              ? 'radial-gradient(circle, rgba(74,222,128,0.04) 0%, transparent 65%)'
              : 'radial-gradient(circle, rgba(22,163,74,0.05) 0%, transparent 65%)',
            pointerEvents: 'none', zIndex: 0,
          }}
        />

        {/* Left — text */}
        <div style={{ flex: '1 1 280px', maxWidth: 520, position: 'relative', zIndex: 1, minWidth: 0 }}>
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100, marginBottom: 24,
              background: isDark ? 'rgba(74,222,128,0.12)' : 'rgba(22,101,52,0.09)',
              border: `1px solid ${isDark ? 'rgba(74,222,128,0.28)' : 'rgba(22,101,52,0.22)'}`,
            }}
          >
            <span style={{ fontSize: 15 }}>🇵🇭</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '0.02em' }}>
              {t('landing.hero.badge')}
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontSize: 'clamp(40px, 6.5vw, 70px)',
              fontWeight: 900,
              lineHeight: 1.07,
              letterSpacing: '-0.025em',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {t('landing.hero.headline1')}
            <br />
            <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>
              {t('landing.hero.headline2')}
            </em>
          </h1>

          {/* Sub */}
          <p
            style={{
              fontSize: 'clamp(15px, 1.8vw, 17px)',
              lineHeight: 1.7, color: 'var(--color-text-secondary)',
              marginTop: 22, marginBottom: 34, maxWidth: 440,
            }}
          >
            {t('landing.hero.sub')}
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link
              href="/register"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '13px 26px', borderRadius: 12,
                background: isDark
                  ? 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)'
                  : 'linear-gradient(135deg, #166534 0%, #16A34A 100%)',
                color: isDark ? '#0C100E' : '#fff',
                fontSize: 15, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(22,163,74,0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform  = 'translateY(-2px)'
                e.currentTarget.style.boxShadow  = '0 7px 28px rgba(22,163,74,0.45)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform  = 'translateY(0)'
                e.currentTarget.style.boxShadow  = '0 4px 20px rgba(22,163,74,0.35)'
              }}
            >
              {t('landing.hero.cta')}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              style={{
                padding: '13px 22px', borderRadius: 12,
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--color-accent)'
                e.currentTarget.style.color       = 'var(--color-accent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.color       = 'var(--color-text-secondary)'
              }}
            >
              {t('landing.hero.login')}
            </Link>
          </div>

          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 16 }}>
            ✓ {t('landing.hero.noCard')}
          </p>
        </div>

        {/* Right — dashboard preview */}
        <div
          style={{
            flex: '1 1 280px', maxWidth: 440, position: 'relative', zIndex: 1,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            minWidth: 0,
          }}
        >
          <div
            style={{ transform: 'rotate(1.5deg)', transition: 'transform 0.35s ease', width: '100%' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'rotate(0deg) translateY(-5px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'rotate(1.5deg)')}
          >
            <DashboardPreview t={t} isDark={isDark} />
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2
              style={{
                fontFamily: 'var(--font-playfair), Georgia, serif',
                fontSize: 'clamp(26px, 4vw, 40px)',
                fontWeight: 700, letterSpacing: '-0.02em',
                color: 'var(--color-text-primary)', marginBottom: 12,
              }}
            >
              {t('landing.features.title')}
            </h2>
            <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', maxWidth: 480, margin: '0 auto' }}>
              {t('landing.features.sub')}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 20,
            }}
          >
            {features.map(({ icon: Icon, titleKey, descKey, color, badge }) => (
              <div
                key={titleKey}
                style={{
                  background: 'var(--color-card)',
                  borderRadius: 16,
                  border: badge === 'premium'
                    ? '1px solid rgba(217,119,6,0.35)'
                    : '1px solid var(--color-border)',
                  borderLeft: `3px solid ${color}`,
                  padding: 24, cursor: 'default',
                  position: 'relative', overflow: 'hidden',
                  transition: 'transform 0.22s, box-shadow 0.22s',
                }}
                onMouseEnter={cardHoverIn}
                onMouseLeave={cardHoverOut}
              >
                {/* Badge */}
                {badge === 'premium' && (
                  <div
                    style={{
                      position: 'absolute', top: 14, right: 14,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 100,
                      background: 'rgba(217,119,6,0.15)',
                      border: '1px solid rgba(217,119,6,0.4)',
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                      color: '#D97706', textTransform: 'uppercase',
                    }}
                  >
                    <Crown size={9} />
                    Premium
                  </div>
                )}
                {badge === 'new' && (
                  <div
                    style={{
                      position: 'absolute', top: 14, right: 14,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 100,
                      background: isDark ? 'rgba(74,222,128,0.12)' : 'rgba(22,101,52,0.1)',
                      border: '1px solid rgba(74,222,128,0.35)',
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                      color: 'var(--color-accent)', textTransform: 'uppercase',
                    }}
                  >
                    New
                  </div>
                )}

                <div
                  style={{
                    width: 42, height: 42, borderRadius: 11,
                    background: isDark ? `${color}20` : `${color}16`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Icon size={20} color={color} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                  {t(titleKey)}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.62 }}>
                  {t(descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FILIPINO SECTION ──────────────────────────────────────────────── */}
      <section
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0C100E, #111C14, #162018)'
            : 'linear-gradient(140deg, #14532D 0%, #166534 60%, #15803D 100%)',
          padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute', right: -80, top: -80, width: 420, height: 420,
            background: 'radial-gradient(circle, rgba(74,222,128,0.1) 0%, transparent 68%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute', left: -60, bottom: -60, width: 300, height: 300,
            background: 'radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1,
            display: 'flex', gap: 52, flexWrap: 'wrap', alignItems: 'center',
          }}
        >
          {/* Left */}
          <div style={{ flex: '1 1 280px', maxWidth: 440, minWidth: 0 }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 13px', borderRadius: 100, marginBottom: 18,
                background: 'rgba(74,222,128,0.15)',
                border: '1px solid rgba(74,222,128,0.32)',
              }}
            >
              <span style={{ fontSize: 13 }}>🇵🇭</span>
              <span
                style={{
                  fontSize: 11, fontWeight: 700, color: '#4ADE80',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}
              >
                Filipino
              </span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-playfair), Georgia, serif',
                fontSize: 'clamp(24px, 4vw, 38px)',
                fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.02em',
                color: isDark ? 'var(--color-text-primary)' : '#F0FDF4',
                marginBottom: 14,
              }}
            >
              {t('landing.fil.title')}
            </h2>
            <p
              style={{
                fontSize: 15, lineHeight: 1.7,
                color: isDark ? 'var(--color-text-secondary)' : 'rgba(240,253,244,0.75)',
              }}
            >
              {t('landing.fil.sub')}
            </p>
          </div>

          {/* Right — feature cards */}
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filipinoFeatures.map(({ icon: Icon, titleKey, descKey }) => (
              <div
                key={titleKey}
                style={{
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14, padding: '18px 20px',
                  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              >
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'rgba(74,222,128,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color="#4ADE80" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 15, fontWeight: 700, marginBottom: 5,
                      color: isDark ? 'var(--color-text-primary)' : '#F0FDF4',
                    }}
                  >
                    {t(titleKey)}
                  </h3>
                  <p
                    style={{
                      fontSize: 13, lineHeight: 1.58,
                      color: isDark ? 'var(--color-text-muted)' : 'rgba(240,253,244,0.72)',
                    }}
                  >
                    {t(descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how" style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 64px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2
              style={{
                fontFamily: 'var(--font-playfair), Georgia, serif',
                fontSize: 'clamp(26px, 4vw, 40px)',
                fontWeight: 700, letterSpacing: '-0.02em',
                color: 'var(--color-text-primary)', marginBottom: 12,
              }}
            >
              {t('landing.how.title')}
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 24,
              maxWidth: 900,
              margin: '0 auto',
            }}
          >
            {steps.map(({ icon: Icon, numKey, titleKey, descKey }) => (
              <div
                key={numKey}
                style={{
                  background: 'var(--color-card)',
                  borderRadius: 18,
                  border: '1px solid var(--color-border)',
                  padding: '28px 24px', position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.22s, box-shadow 0.22s',
                }}
                onMouseEnter={cardHoverIn}
                onMouseLeave={cardHoverOut}
              >
                {/* Large background number */}
                <div
                  style={{
                    position: 'absolute', top: 12, right: 18,
                    fontFamily: 'var(--font-playfair), Georgia, serif',
                    fontSize: 58, fontWeight: 900, lineHeight: 1,
                    color: isDark ? 'rgba(74,222,128,0.12)' : 'rgba(22,101,52,0.1)',
                    userSelect: 'none', pointerEvents: 'none',
                  }}
                >
                  {t(numKey)}
                </div>
                <div
                  style={{
                    width: 42, height: 42, borderRadius: 12, marginBottom: 16,
                    background: isDark ? 'rgba(74,222,128,0.12)' : 'rgba(22,101,52,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color="var(--color-accent)" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10 }}>
                  {t(titleKey)}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.62 }}>
                  {t(descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: 'clamp(60px, 8vw, 90px) clamp(16px, 5vw, 64px)',
          background: isDark
            ? 'linear-gradient(135deg, #111C14 0%, #162018 100%)'
            : 'linear-gradient(140deg, #14532D 0%, #166534 100%)',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700, height: 350,
            background: 'radial-gradient(ellipse, rgba(74,222,128,0.14) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontSize: 'clamp(24px, 4vw, 40px)',
              fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em',
              color: isDark ? 'var(--color-text-primary)' : '#F0FDF4',
              marginBottom: 14,
            }}
          >
            {t('landing.cta.title')}
          </h2>
          <p
            style={{
              fontSize: 16, lineHeight: 1.68, marginBottom: 32,
              color: isDark ? 'var(--color-text-secondary)' : 'rgba(240,253,244,0.8)',
            }}
          >
            {t('landing.cta.sub')}
          </p>
          <Link
            href="/register"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 32px', borderRadius: 14,
              background: isDark ? 'linear-gradient(135deg, #16A34A, #4ADE80)' : '#F0FDF4',
              color: isDark ? '#0C100E' : '#14532D',
              fontSize: 16, fontWeight: 800, textDecoration: 'none',
              boxShadow: isDark ? '0 4px 22px rgba(74,222,128,0.3)' : '0 4px 22px rgba(0,0,0,0.2)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = isDark ? '0 8px 32px rgba(74,222,128,0.4)' : '0 8px 32px rgba(0,0,0,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = isDark ? '0 4px 22px rgba(74,222,128,0.3)' : '0 4px 22px rgba(0,0,0,0.2)'
            }}
          >
            {t('landing.cta.button')}
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: '24px clamp(16px, 5vw, 64px)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image
            src={isDark ? '/logo-dark.png' : '/logo.png'}
            alt="WaiseKa"
            width={28}
            height={28}
            style={{ borderRadius: 8, objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>WaiseKa</span>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
              {t('landing.footer.tagline')}
            </p>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          © {new Date().getFullYear()} WaiseKa. {t('landing.footer.rights')}
        </p>
      </footer>

    </div>
  )
}
