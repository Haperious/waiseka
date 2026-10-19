'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell, RegisterPanel } from '@/components/auth/AuthShell'
import { PasswordMatch, PasswordStrength } from '@/components/auth/PasswordFeedback'
import styles from '@/components/auth/auth.module.css'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import { useToast } from '@/components/ui/Toast'
import { LEGAL_DOCUMENT_PATHS } from '@/lib/legal/legalDocuments'
import { isLegalPagesPublic } from '@/lib/legal/visibility'

interface FieldErrors {
  name?: string
  email?: string
  /** Set when the API reports the email is already registered (409). */
  emailTaken?: boolean
  password?: string
  confirmPassword?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const legalPublic = isLegalPagesPublic()

  const validate = (): boolean => {
    const e: FieldErrors = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password'
    else if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords don't match yet"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (res.status === 409) {
        setErrors({ emailTaken: true })
      } else if (!res.ok) {
        setErrors({ email: data.error })
      } else {
        toast('Account created successfully! Please sign in.', 'success')
        router.push('/login')
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const emailError = errors.emailTaken ? (
    <>
      That email already has a WaiseKa account.{' '}
      <Link href="/login" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
        Sign in instead?
      </Link>
    </>
  ) : (
    errors.email
  )

  return (
    <AuthShell
      headline={<>Start your <br className={styles.desktopOnly} /><em>first cutoff.</em></>}
      panel={<RegisterPanel />}
      panelFooter="Free to start · PHP, QAR and USD"
    >
      <div className={styles.titleBlock}>
        <div className={styles.desktopOnly}>
          <h2 className={styles.title}>Create your <em>account.</em></h2>
          <p className={styles.sub} style={{ marginTop: 8 }}>Tara, simulan natin. It takes about a minute.</p>
        </div>
        <div className={styles.mobileOnly}>
          <h2 className={styles.mobileTitle}>Create your account</h2>
          <p className={styles.mobileSub}>Tara, simulan natin. It takes about a minute.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          id="name"
          label="Full name"
          placeholder="Juan dela Cruz"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          autoComplete="name"
        />
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={emailError}
          autoComplete="email"
        />
        <div>
          <PasswordInput
            id="password"
            label="Password"
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
            label="Confirm password"
            placeholder="Repeat password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
          {!errors.confirmPassword && <PasswordMatch password={form.password} confirm={form.confirmPassword} />}
        </div>

        <div className={styles.bottom}>
          <Button type="submit" size="lg" loading={loading} style={{ width: '100%' }}>
            Create free account
          </Button>
          <p className={styles.legal}>
            By signing up, you agree to the{' '}
            {legalPublic ? <Link href={LEGAL_DOCUMENT_PATHS.terms}>Terms</Link> : 'Terms'} and{' '}
            {legalPublic ? <Link href={LEGAL_DOCUMENT_PATHS.privacy}>Privacy Policy</Link> : 'Privacy Policy'}.
          </p>
          <hr className={`${styles.hairline} ${styles.desktopOnly}`} />
          <p className={styles.switch}>
            Already have an account?{' '}
            <Link href="/login" className={styles.link}>
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  )
}
