'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react'
import { AuthIconTile, AuthShell, BuiltForPill, LoginPanel } from '@/components/auth/AuthShell'
import styles from '@/components/auth/auth.module.css'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

/** Seconds before "Resend link" unlocks after a send. */
const RESEND_COOLDOWN_S = 60

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const sendLink = async () => {
    setLoading(true)
    setError('')
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
      setCooldown(RESEND_COOLDOWN_S)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required'); return }
    await sendLink()
  }

  return (
    <AuthShell
      kicker={<BuiltForPill />}
      headline={<>Your sweldo, <br className={styles.desktopOnly} /><em>sorted.</em></>}
      panel={<LoginPanel />}
    >
      {sent ? (
        <div className={styles.stack}>
          <AuthIconTile icon={MailCheck} />
          <div className={styles.titleBlock}>
            <h2 className={styles.title}>Check your <em>inbox.</em></h2>
            <p className={styles.sub}>
              If <strong>{email}</strong> has a WaiseKa account, a reset link is on its way. It&apos;s valid for 30 minutes.
            </p>
          </div>
          <p className={styles.tip}>
            <strong>Wala pa rin?</strong> Check your Spam or Promotions folder before resending.
          </p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actionsPlain}>
            <Button
              type="button"
              variant="outline"
              size="lg"
              loading={loading}
              disabled={cooldown > 0}
              onClick={sendLink}
              style={{ width: '100%', fontVariantNumeric: 'tabular-nums' }}
            >
              {cooldown > 0 ? `Resend link in ${formatCountdown(cooldown)}` : 'Resend link'}
            </Button>
            <Link href="/login" className={styles.link} style={{ fontSize: '0.88rem' }}>
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.stack}>
          <Link href="/login" className={styles.backLink}>
            <ArrowLeft size={15} />
            Back to sign in
          </Link>
          <AuthIconTile icon={KeyRound} />
          <div className={styles.titleBlock}>
            <h2 className={styles.title}>Forgot your <em>password?</em></h2>
            <p className={styles.sub}>
              Okay lang, nangyayari &apos;yan. Enter the email you registered with and WaiseKa will send you a reset link.
            </p>
          </div>
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            autoComplete="email"
          />
          <div className={styles.bottom}>
            <Button type="submit" size="lg" loading={loading} style={{ width: '100%' }}>
              Send reset link
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
