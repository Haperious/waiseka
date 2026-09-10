'use client'

import type { ReactNode } from 'react'
import { Delete } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

const DEFAULT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

export interface KeypadActionKey {
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  ariaLabel?: string
}

interface KeypadProps {
  value: string
  onChange: (value: string) => void
  /** Grid cells in row-major order. 'del' and '.' are special; everything else ('00' included) is treated as a digit run. */
  keys?: string[]
  columns?: number
  keyHeight?: number
  /** Renders as a grid item spanning 3 rows in the last column - the space the digit grid leaves free when `keys` reserves it. */
  actionKey?: KeypadActionKey
  maxDecimals?: number
  maxDigits?: number
}

export function pressKeypadKey(
  prev: string,
  key: string,
  opts?: { maxDecimals?: number; maxDigits?: number }
): string {
  if (key === 'del') return prev.slice(0, -1)

  if (key === '.') {
    if (prev.includes('.')) return prev
    return prev === '' ? '0.' : prev + '.'
  }

  // Digit run ('0'-'9' or '00')
  if (prev === '' && key === '00') return prev
  if (prev === '0') return key === '00' ? prev : key

  if (prev.includes('.')) {
    const decimals = prev.split('.')[1] ?? ''
    if (opts?.maxDecimals !== undefined && decimals.length + key.length > opts.maxDecimals) return prev
  }

  const significant = prev.replace('.', '')
  if (opts?.maxDigits !== undefined && significant.length + key.length > opts.maxDigits) return prev

  return prev + key
}

export default function Keypad({
  value,
  onChange,
  keys = DEFAULT_KEYS,
  columns = 3,
  keyHeight = 52,
  actionKey,
  maxDecimals,
  maxDigits,
}: KeypadProps) {
  const { t } = useLanguage()
  const press = (key: string) => onChange(pressKeypadKey(value, key, { maxDecimals, maxDigits }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 7 }}>
      {keys.map((key, i) => (
        <button
          key={`${key}-${i}`}
          type="button"
          onClick={() => press(key)}
          className="flex items-center justify-center font-semibold text-lg transition-colors active:opacity-70"
          style={{
            height: keyHeight,
            borderRadius: 12,
            backgroundColor: 'var(--color-elevated)',
            color: 'var(--color-text-primary)',
          }}
          aria-label={key === 'del' ? t('common.delete') : key}
        >
          {key === 'del' ? <Delete className="h-5 w-5" /> : key}
        </button>
      ))}
      {actionKey && (
        <button
          type="button"
          onClick={actionKey.onClick}
          disabled={actionKey.disabled}
          className="flex flex-col items-center justify-center gap-1 font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none"
          style={{
            gridColumn: columns,
            gridRow: 'span 3',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #166534, #16A34A)',
            boxShadow: actionKey.disabled ? 'none' : '0 4px 20px rgba(22,163,74,.35)',
          }}
          aria-label={actionKey.ariaLabel ?? actionKey.label}
        >
          {actionKey.icon}
          <span className="text-xs">{actionKey.label}</span>
        </button>
      )}
    </div>
  )
}
