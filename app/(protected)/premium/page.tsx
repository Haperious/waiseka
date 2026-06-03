'use client'

import { useState } from 'react'
import { Check, Sparkles, Zap, Crown } from 'lucide-react'

const FEATURES = [
  'AI-powered financial analysis',
  'Smart spending recommendations',
  'Automated budget insights',
  'Goal progress predictions',
  'Monthly financial health report',
  'Priority support',
]

export default function PremiumPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly')

  const monthlyPrice = 3.99
  const yearlyPrice = 39.99
  const yearlyMonthly = (yearlyPrice / 12).toFixed(2)
  const yearlySavings = Math.round(100 - (yearlyPrice / (monthlyPrice * 12)) * 100)

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg)',
      padding: '48px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center', maxWidth: 560, marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'var(--color-sage)',
          color: 'var(--color-accent)',
          borderRadius: 999,
          padding: '6px 16px',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 20,
        }}>
          <Sparkles size={14} />
          WaiseKa Premium
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 40px)',
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          lineHeight: 1.15,
          marginBottom: 14,
        }}>
          Unlock your full financial picture
        </h1>
        <p style={{
          fontSize: 16,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6,
        }}>
          Get AI-driven insights that help you spend smarter, save faster, and hit your goals with confidence.
        </p>
      </div>

      {/* Billing toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'var(--color-elevated)',
        borderRadius: 999,
        padding: 4,
        marginBottom: 36,
      }}>
        {(['monthly', 'yearly'] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBilling(b)}
            style={{
              padding: '8px 22px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.18s ease',
              backgroundColor: billing === b ? 'var(--color-card)' : 'transparent',
              color: billing === b ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              boxShadow: billing === b ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {b === 'yearly' && (
              <span style={{
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 999,
                letterSpacing: '0.03em',
              }}>
                SAVE {yearlySavings}%
              </span>
            )}
            {b.charAt(0).toUpperCase() + b.slice(1)}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        width: '100%',
        maxWidth: 700,
        marginBottom: 48,
      }}>
        {/* Free plan */}
        <div style={{
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: '28px 28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: 'var(--color-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={18} style={{ color: 'var(--color-text-secondary)' }} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>Free</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-text-primary)' }}>$0</span>
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>/month</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 }}>
              Core budgeting tools, always free.
            </p>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Transaction tracking', 'Budget categories', 'Basic reports', 'Goal setting'].map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                <Check size={15} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>

          <div style={{
            marginTop: 'auto',
            padding: '11px 0',
            borderRadius: 12,
            border: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            backgroundColor: 'transparent',
          }}>
            Current plan
          </div>
        </div>

        {/* Premium plan */}
        <div style={{
          backgroundColor: 'var(--color-primary)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20,
          padding: '28px 28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{
            position: 'absolute',
            top: -40, right: -40,
            width: 160, height: 160,
            borderRadius: '50%',
            backgroundColor: 'rgba(74,222,128,0.12)',
            pointerEvents: 'none',
          }} />

          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Crown size={18} style={{ color: '#fff' }} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Premium</span>
            </div>

            {billing === 'yearly' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#fff' }}>${yearlyMonthly}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>/month</span>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
                  Billed annually at ${yearlyPrice} USD
                </p>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#fff' }}>${monthlyPrice}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>/month</span>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
                  Billed monthly
                </p>
              </>
            )}
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Everything in Free', ...FEATURES].map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.90)' }}>
                <Check size={15} style={{ color: '#4ADE80', flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>

          <button
            disabled
            style={{
              marginTop: 'auto',
              padding: '13px 0',
              borderRadius: 12,
              border: 'none',
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.50)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'not-allowed',
              width: '100%',
            }}
          >
            Coming soon
          </button>
        </div>
      </div>

      {/* Footer note */}
      <p style={{
        fontSize: 13,
        color: 'var(--color-text-muted)',
        textAlign: 'center',
        maxWidth: 440,
      }}>
        Payment processing is coming soon. We&apos;ll notify you when Premium is available to purchase.
        All prices are in USD.
      </p>
    </div>
  )
}
