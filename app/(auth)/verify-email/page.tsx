'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSession } from 'next-auth/react'
import { CircleCheck, Mail, MailWarning, Unlink } from 'lucide-react'
import { AuthIconTile, AuthShell, RegisterPanel } from '@/components/auth/AuthShell'
import styles from '@/components/auth/auth.module.css'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success') === 'true'
  const error = searchParams.get('error')
  const { toast } = useToast()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    // Signed-in but unverified users land here; show which address the link went to.
    getSession()
      .then((s) => setEmail(s?.user?.email ?? ''))
      .catch(() => {})
  }, [])

  const resend = async () => {
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setResent(true)
        toast('Verification email sent', 'success')
      } else {
        toast(data.error ?? 'Failed to resend', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setResending(false)
    }
  }

  const backToSignIn = (
    <Link href="/login" className={styles.link} style={{ fontSize: '0.88rem' }}>
      Back to sign in
    </Link>
  )

  const resentNote = (
    <p className={styles.match} style={{ marginTop: 0 }}>
      <CircleCheck size={14} />
      New verification email sent - check your inbox.
    </p>
  )

  if (success) {
    return (
      <div className={styles.stack}>
        <AuthIconTile icon={CircleCheck} variant="success" />
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>Email <em>verified.</em></h2>
          <p className={styles.sub}>Your account is active. Tara, let&apos;s set up your first cutoff.</p>
        </div>
        <div className={styles.actionsPlain}>
          {/* /dashboard falls through to /login via the proxy when there's no session */}
          <Link href="/dashboard" className={styles.buttonLink}>
            Continue to WaiseKa
          </Link>
        </div>
      </div>
    )
  }

  if (error === 'invalid') {
    return (
      <div className={styles.stack}>
        <AuthIconTile icon={MailWarning} variant="warning" />
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>Link <em>expired.</em></h2>
          <p className={styles.sub}>
            This verification link has expired or was already used. Request a new one below.
          </p>
        </div>
        <div className={styles.actionsPlain}>
          {resent ? (
            resentNote
          ) : (
            <Button size="lg" onClick={resend} loading={resending} style={{ width: '100%' }}>
              Resend verification email
            </Button>
          )}
          {backToSignIn}
        </div>
      </div>
    )
  }

  // Not in the handoff (the API's malformed-link redirect); styled like the other error states.
  if (error === 'missing') {
    return (
      <div className={styles.stack}>
        <AuthIconTile icon={Unlink} variant="error" />
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>Invalid <em>link.</em></h2>
          <p className={styles.sub}>
            This verification link is malformed. Use the link from your email or request a new one.
          </p>
        </div>
        <div className={styles.actionsPlain}>
          <Link href="/login" className={styles.buttonLinkOutline}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  // Default: landing page (user navigated here directly)
  return (
    <div className={styles.stack}>
      <AuthIconTile icon={Mail} />
      <div className={styles.titleBlock}>
        <h2 className={styles.title}>Check your <em>inbox.</em></h2>
        <p className={styles.sub}>
          A verification link went to {email ? <strong>{email}</strong> : 'your email address'}. Click it to activate
          your account.
        </p>
      </div>
      <div className={styles.actionsPlain}>
        {resent ? (
          resentNote
        ) : (
          <Button variant="outline" size="lg" onClick={resend} loading={resending} style={{ width: '100%' }}>
            Resend verification email
          </Button>
        )}
        {backToSignIn}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      headline={<>Start your <br className={styles.desktopOnly} /><em>first cutoff.</em></>}
      panel={<RegisterPanel />}
      panelFooter="Free to start · PHP, QAR and USD"
    >
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  )
}
