'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import styles from './auth.module.css'

const LENGTH = 6

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  /** Called once all six digits are filled by typing or pasting. */
  onComplete?: (value: string) => void
  invalid?: boolean
  disabled?: boolean
}

/**
 * Six single-digit boxes for a TOTP code. Typing advances, Backspace on an empty
 * box moves back, and pasting (or one-time-code autofill) fills every box.
 */
const OtpInput = forwardRef<{ focus: () => void }, OtpInputProps>(
  ({ value, onChange, onComplete, invalid, disabled }, ref) => {
    const boxes = useRef<(HTMLInputElement | null)[]>([])
    // Box to focus once the parent has applied the new value. Focusing straight away
    // would run the onFocus guard below against the stale value.
    const pendingFocus = useRef<number | null>(null)

    useEffect(() => {
      if (pendingFocus.current === null) return
      boxes.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }, [value])

    const focusAfterUpdate = (index: number) => {
      pendingFocus.current = Math.min(index, LENGTH - 1)
    }

    useImperativeHandle(ref, () => ({
      focus: () => boxes.current[Math.min(value.length, LENGTH - 1)]?.focus(),
    }))

    /** Write digits starting at a box, keeping any digits after them, then focus the next box. */
    const fill = (from: number, digits: string) => {
      const next = (value.slice(0, from) + digits + value.slice(from + digits.length)).slice(0, LENGTH)
      focusAfterUpdate(from + digits.length)
      onChange(next)
      if (next.length === LENGTH) onComplete?.(next)
    }

    const handleChange = (index: number, raw: string) => {
      const digits = raw.replace(/\D/g, '')
      if (!digits) return
      // A box can briefly hold its old digit plus the new one; keep only what was typed.
      // Longer input (one-time-code autofill into the first box) fills from here.
      fill(index, raw.length === 2 ? digits.slice(-1) : digits)
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        e.preventDefault()
        if (value[index]) {
          onChange(value.slice(0, index))
        } else if (index > 0) {
          focusAfterUpdate(index - 1)
          onChange(value.slice(0, index - 1))
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        boxes.current[index - 1]?.focus()
      } else if (e.key === 'ArrowRight' && index < value.length) {
        boxes.current[index + 1]?.focus()
      }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const digits = e.clipboardData.getData('text').replace(/\D/g, '')
      if (!digits) return
      e.preventDefault()
      const next = digits.slice(0, LENGTH)
      focusAfterUpdate(next.length)
      onChange(next)
      if (next.length === LENGTH) onComplete?.(next)
    }

    return (
      <div className={`${styles.otp} ${invalid ? styles.otpError : ''}`} role="group" aria-label="6-digit code">
        {Array.from({ length: LENGTH }, (_, i) => (
          <input
            key={i}
            ref={(el) => { boxes.current[i] = el }}
            className={styles.otpBox}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid || undefined}
            maxLength={i === 0 ? LENGTH : 2}
            value={value[i] ?? ''}
            disabled={disabled}
            // Only the next empty box (or a filled one) can take focus, so digits stay contiguous.
            onFocus={(e) => {
              if (i > value.length) boxes.current[value.length]?.focus()
              else e.target.select()
            }}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
          />
        ))}
      </div>
    )
  }
)

OtpInput.displayName = 'OtpInput'

export default OtpInput
