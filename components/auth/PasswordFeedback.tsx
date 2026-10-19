import { CircleCheck } from 'lucide-react'
import styles from './auth.module.css'

/** 1-4. Length 8+, mixed case, a digit, and a symbol (or 12+ characters) each add a point. */
function scorePassword(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++
  return Math.max(score, 1)
}

/** 4-segment strength meter. The label is hidden on mobile. Renders nothing for an empty password. */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const score = scorePassword(password)
  const strong = score === 4
  const color = strong ? 'var(--color-income)' : 'var(--color-warning)'
  return (
    <>
      <div className={styles.meter} aria-hidden="true">
        {[1, 2, 3, 4].map((seg) => (
          <span key={seg} className={styles.meterSeg} style={seg <= score ? { background: color } : undefined} />
        ))}
      </div>
      <p className={styles.meterLabel} aria-live="polite">
        <strong style={{ color }}>{strong ? 'Malakas.' : 'Okay pa lang.'}</strong>{' '}
        {strong ? 'Good to go.' : 'Add a symbol or a few more characters.'}
      </p>
    </>
  )
}

/** "Passwords match" confirmation, shown once the confirm field equals the password. */
export function PasswordMatch({ password, confirm }: { password: string; confirm: string }) {
  if (!confirm || password !== confirm) return null
  return (
    <p className={styles.match}>
      <CircleCheck size={14} />
      Passwords match
    </p>
  )
}
