'use client'

import { useEffect, useState } from 'react'

/** Small "PERA" health ring used inside the Total Money card (72px, per the dashboard v2 spec). */
export default function CompactHealthRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 9) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(score, 100) / 100) * circ

  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(t)
  }, [score])

  const ringColor =
    score >= 70 ? 'var(--color-income)' :
    score >= 45 ? 'var(--color-warning)' :
    'var(--color-expense)'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-elevated)" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={ringColor} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={animated ? `${offset}` : `${circ}`}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: '1.05rem', fontWeight: 800,
          color: ringColor, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(score)}
        </span>
        <span style={{
          fontSize: '0.5rem', color: 'var(--color-text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2,
        }}>
          PERA
        </span>
      </div>
    </div>
  )
}
