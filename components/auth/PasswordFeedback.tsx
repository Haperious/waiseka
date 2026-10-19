import { CircleCheck } from 'lucide-react'
import { scorePassword } from '@/lib/passwordStrength'
import styles from './auth.module.css'

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
