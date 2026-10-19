'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, signOut } from 'next-auth/react'
import { CircleAlert, ShieldCheck } from 'lucide-react'
import { AuthIconTile, AuthShell, BuiltForPill, LoginPanel } from '@/components/auth/AuthShell'
import OtpInput from '@/components/auth/OtpInput'
import styles from '@/components/auth/auth.module.css'
import Button from '@/components/ui/Button'

// Copy the API returns for a wrong code (app/api/auth/mfa/validate-session).
const INVALID_CODE_API_ERROR = 'Invalid code. Please try again.'
const INVALID_CODE_MESSAGE = "That code didn't work. Codes refresh every 30 seconds, so try the newest one."

export default function MfaLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [invalidCode, setInvalidCode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [useBackup, setUseBackup] = useState(false)
  const otpRef = useRef<{ focus: () => void }>(null)
  const backupRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // The pending (pre-MFA) session already carries the user's email.
    getSession()
      .then((s) => setEmail(s?.user?.email ?? ''))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (useBackup) backupRef.current?.focus()
    else otpRef.current?.focus()
  }, [useBackup])

  const verify = async (code: string) => {
    if (loading) return
    setError('')
    setInvalidCode(false)
    setLoading(true)

    try {
      // We use the current session to identify the user- the validate route reads session server-side
      const res = await fetch('/api/auth/mfa/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        const message: string = data.error ?? INVALID_CODE_API_ERROR
        if (message === INVALID_CODE_API_ERROR) {
          setInvalidCode(true)
          setError(useBackup ? message : INVALID_CODE_MESSAGE)
        } else {
          setError(message)
        }
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!useBackup && token.length < 6) {
      otpRef.current?.focus()
      return
    }
    verify(token)
  }

  const switchMode = () => {
    setUseBackup((v) => !v)
    setToken('')
    setError('')
    setInvalidCode(false)
  }

  return (
    <AuthShell
      kicker={<BuiltForPill />}
      headline={<>Your sweldo, <br className={styles.desktopOnly} /><em>sorted.</em></>}
      panel={<LoginPanel />}
    >
      <div className={styles.stack}>
        <AuthIconTile icon={ShieldCheck} />
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>One more <em>step.</em></h2>
          <p className={styles.sub}>
            {useBackup ? (
              'Enter one of your backup codes.'
            ) : (
              <>
                Open your authenticator app and enter the 6-digit code
                {email ? <> for <strong>{email}</strong></> : null}.
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {useBackup ? (
            <input
              ref={backupRef}
              className={styles.codeInput}
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              aria-label="Backup code"
              placeholder="XXXX-XXXX"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              maxLength={9}
              required
              style={invalidCode ? { borderColor: '#EF4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.2)' } : undefined}
            />
          ) : (
            <OtpInput
              ref={otpRef}
              value={token}
              onChange={(v) => {
                setToken(v)
                if (invalidCode) setInvalidCode(false)
              }}
              onComplete={verify}
              invalid={invalidCode}
              disabled={loading}
            />
          )}

          {error && (
            <div className={styles.error} role="alert">
              <CircleAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} style={{ width: '100%' }}>
            Verify
          </Button>
        </form>

        <div className={styles.actions}>
          <button type="button" onClick={switchMode} className={styles.textButton}>
            {useBackup ? 'Use authenticator app instead' : 'Use a backup code instead'}
          </button>
          {/* Unverified sessions are confined to this page, so offer a way out */}
          <button
            type="button"
            onClick={() => signOut({ redirectTo: '/login' })}
            className={styles.textButtonMuted}
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
