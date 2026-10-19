'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import { AuthShell, BuiltForPill, LoginPanel } from '@/components/auth/AuthShell'
import styles from '@/components/auth/auth.module.css'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import { LOGIN_RATE_LIMITED_CODE } from '@/lib/constants'

type LoginError = '' | 'credentials' | 'rate-limited'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<LoginError>('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.code === LOGIN_RATE_LIMITED_CODE) {
      setError('rate-limited')
    } else if (result?.error) {
      setError('credentials')
    } else {
      // Check if MFA is enabled for this user before proceeding to dashboard
      try {
        const mfaRes = await fetch('/api/auth/mfa/status')
        if (mfaRes.ok) {
          const mfaData = await mfaRes.json()
          if (mfaData.enabled) {
            router.push('/login/mfa')
            return
          }
        }
      } catch {
        // If status check fails, fall through to dashboard
      }
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <AuthShell
      kicker={<BuiltForPill />}
      headline={<>Your sweldo, <br className={styles.desktopOnly} /><em>sorted.</em></>}
      panel={<LoginPanel />}
    >
      <div className={styles.titleBlock}>
        <div className={styles.desktopOnly}>
          <h2 className={styles.title}>Welcome <em>back.</em></h2>
          <p className={styles.sub} style={{ marginTop: 8 }}>
            Kumusta ang pera mo? Sign in to see this cutoff&apos;s numbers.
          </p>
        </div>
        <div className={styles.mobileOnly}>
          <h2 className={styles.mobileTitle}>Sign in</h2>
          <p className={styles.mobileSub}>Kumusta ang pera mo?</p>
        </div>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          <CircleAlert size={16} />
          {error === 'rate-limited' ? (
            <span>Too many sign-in attempts. Please wait a few minutes and try again.</span>
          ) : (
            <span>
              <span className={styles.errorFull}>
                That email and password don&apos;t match. Check for typos, or{' '}
                <Link href="/forgot-password" className={styles.link} style={{ color: 'inherit', textDecoration: 'underline' }}>
                  reset your password
                </Link>
                .
              </span>
              <span className={styles.errorShort}>That email and password don&apos;t match.</span>
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <div>
          <PasswordInput
            id="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className={styles.fieldLink}>
            <Link href="/forgot-password" className={styles.smallLink}>
              Forgot password?
            </Link>
          </div>
        </div>

        <div className={styles.bottom}>
          <Button type="submit" size="lg" loading={loading} style={{ width: '100%' }}>
            Sign in
          </Button>
          <hr className={`${styles.hairline} ${styles.desktopOnly}`} />
          <p className={styles.switch}>
            New to WaiseKa?{' '}
            <Link href="/register" className={styles.link}>
              Create a free account
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  )
}
