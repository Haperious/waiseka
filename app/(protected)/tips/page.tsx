'use client'

import Link from 'next/link'
import { tips } from '@/lib/tipsContent'
import type { Tip } from '@/lib/tipsContent'

// ── Inline SVG icons matching the mockup stroke style ────────────────────────
function TipIcon({ iconKey }: { iconKey: Tip['iconKey'] }) {
  const shared = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (iconKey) {
    case 'pie':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5V12L18 16" />
          <path d="M12 12L6.5 17" />
        </svg>
      )
    case 'piggy':
      return (
        <svg {...shared}>
          <rect x="4" y="10" width="16" height="9" rx="2" />
          <path d="M12 3v8M9 8l3 3 3-3" />
          <path d="M9 14.5h6" />
        </svg>
      )
    case 'autoTransfer':
      return (
        <svg {...shared}>
          <path d="M5 9a7 7 0 0 1 12.5-3.5M19 5v4h-4" />
          <path d="M19 15a7 7 0 0 1-12.5 3.5M5 19v-4h4" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...shared}>
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...shared}>
          <rect x="4" y="9" width="16" height="11" rx="1.5" />
          <path d="M4 13h16M12 9v11" />
          <path d="M12 9c-1.5-3-5-3-5 0M12 9c1.5-3 5-3 5 0" />
        </svg>
      )
    case 'receipt':
      return (
        <svg {...shared} strokeWidth={1.6}>
          <path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V3Z" />
          <path d="M9 8h6M9 11h6M9 14h3" />
        </svg>
      )
  }
}

// ── Single tip card ───────────────────────────────────────────────────────────
function TipCard({ tip }: { tip: Tip }) {
  return (
    <article
      style={{
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: '18px 18px 16px',
      }}
    >
      {/* Header: icon + titles */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: 'var(--color-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--color-primary)',
          }}
        >
          <TipIcon iconKey={tip.iconKey} />
        </div>
        <div style={{ paddingTop: 2 }}>
          <p style={{
            fontSize: '0.93rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: 3,
            lineHeight: 1.3,
          }}>
            {tip.title}
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            fontStyle: 'italic',
          }}>
            {tip.filipinoFraming}
          </p>
        </div>
      </div>

      {/* Body */}
      <p style={{
        fontSize: '0.82rem',
        lineHeight: 1.65,
        color: 'var(--color-text-primary)',
        opacity: 0.92,
        marginBottom: 14,
      }}>
        {tip.body}
      </p>

      {/* Steps */}
      <ul style={{
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: tip.cta ? 14 : 2,
        padding: 0,
      }}>
        {tip.steps.map((step, i) => (
          <li key={i} style={{ display: 'flex', gap: 9, fontSize: '0.79rem', lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
            <span style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: '1.5px solid var(--color-accent)',
              flexShrink: 0,
              marginTop: 1,
              display: 'inline-block',
            }} />
            {step}
          </li>
        ))}
      </ul>

      {/* Optional CTA */}
      {tip.cta && (
        <Link
          href={tip.cta.route}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 13px',
            borderRadius: 10,
            backgroundColor: 'var(--color-elevated)',
            border: '1px solid var(--color-border)',
            fontSize: '0.77rem',
            fontWeight: 600,
            color: 'var(--color-primary)',
            textDecoration: 'none',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        >
          <span>{tip.cta.label}</span>
          <span style={{ fontFamily: "'DM Mono', monospace" }}>→</span>
        </Link>
      )}
    </article>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TipsPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{
          fontSize: '1.6rem',
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 4,
        }}>
          Tips &amp; Gabay
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          Walang judgment, just friendly reminders to help your sweldo go further.
        </p>
      </div>

      {/* Tip cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tips.map(tip => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>
    </div>
  )
}
