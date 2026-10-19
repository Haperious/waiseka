'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LockKeyhole, Unlink } from 'lucide-react'
import { AuthIconTile, AuthShell, BuiltForPill, LoginPanel } from '@/components/auth/AuthShell'
import { PasswordMatch, PasswordStrength } from '@/components/auth/PasswordFeedback'
import styles from '@/components/auth/auth.module.css'
import Button from '@/components/ui/Button'
import PasswordInput from '@/components/ui/PasswordInput'
import { useToast } from '@/components/ui/Toast'

// Copy the API returns for a missing, used, or expired token (app/api/auth/reset-password).
const INVALID_TOKEN_API_ERROR = 'Invalid or expired reset link'

function InvalidLink() {
  return (
    <div className={styles.stack}>
      <AuthIconTile icon={Unlink} variant="error" />
      <div className={styles.titleBlock}>
        <h2 className={styles.title}>This link <em>won&apos;t work.</em></h2>
        <p className={styles.sub}>
          It&apos;s missing, malformed, or past its 30 minutes. Request a fresh one and open it right away.
        </p>
      </div>
      <div className={styles.actionsPlain}>
        <Link href="/forgot-password" className={styles.buttonLink}>
          Request new link
        </Link>
        <Link href="/login" className={styles.link} style={{ fontSize: '0.88rem' }}>
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [tokenRejected, setTokenRejected] = useState(false)

  if (!token || tokenRejected) return <InvalidLink />

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords don't match yet"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === INVALID_TOKEN_API_ERROR) setTokenRejected(true)
        else setErrors({ password: data.error })
      } else {
        toast('Password updated! Please log in.', 'success')
        router.push('/login')
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.stack}>
      <AuthIconTile icon={LockKeyhole} />
      <div className={styles.titleBlock}>
        <h2 className={styles.title}>Set a new <em>password.</em></h2>
        <p className={styles.sub}>At least 8 characters. Pick one you haven&apos;t used here before.</p>
      </div>
      <div className={styles.form}>
        <div>
          <PasswordInput
            id="password"
            label="New password"
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
            autoComplete="new-password"
          />
          <PasswordStrength password={form.password} />
        </div>
        <div>
          <PasswordInput
            id="confirmPassword"
            label="Confirm new password"
            placeholder="Repeat password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
          {!errors.confirmPassword && <PasswordMatch password={form.password} confirm={form.confirmPassword} />}
        </div>
      </div>
      <div className={styles.bottom}>
        <Button type="submit" size="lg" loading={loading} style={{ width: '100%' }}>
          Set new password
        </Button>
        <p className={styles.switch}>
          <Link href="/login" className={styles.link}>
            Back to sign in
          </Link>
        </p>
      </div>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      kicker={<BuiltForPill />}
      headline={<>Your sweldo, <br className={styles.desktopOnly} /><em>sorted.</em></>}
      panel={<LoginPanel />}
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
