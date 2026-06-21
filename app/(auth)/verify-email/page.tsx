'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success') === 'true'
  const error = searchParams.get('error')
  const { toast } = useToast()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

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

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">✅</div>
        <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
          Email verified!
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Your account is now active. You can log in and start using WaiseKa.
        </p>
        <Link href="/login">
          <Button className="w-full mt-2">Go to login</Button>
        </Link>
      </div>
    )
  }

  if (error === 'invalid') {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">❌</div>
        <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
          Link expired or invalid
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          This verification link has expired or already been used. Request a new one below.
        </p>
        {resent ? (
          <p className="text-sm font-medium" style={{ color: 'var(--color-income)' }}>
            New verification email sent - check your inbox.
          </p>
        ) : (
          <Button onClick={resend} loading={resending} className="w-full">
            Resend verification email
          </Button>
        )}
        <p className="text-sm">
          <Link href="/login" style={{ color: 'var(--color-accent)' }}>
            Back to login
          </Link>
        </p>
      </div>
    )
  }

  if (error === 'missing') {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">🔗</div>
        <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
          Invalid link
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          This verification link is malformed. Use the link from your email or request a new one.
        </p>
        <Link href="/login">
          <Button variant="outline" className="w-full">Back to login</Button>
        </Link>
      </div>
    )
  }

  // Default: landing page (user navigated here directly)
  return (
    <div className="text-center space-y-4">
      <div className="text-5xl">✉️</div>
      <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
        Check your inbox
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        We sent a verification link to your email address. Click it to activate your account.
      </p>
      {resent ? (
        <p className="text-sm font-medium" style={{ color: 'var(--color-income)' }}>
          New verification email sent - check your inbox.
        </p>
      ) : (
        <Button variant="outline" onClick={resend} loading={resending} className="w-full">
          Resend verification email
        </Button>
      )}
      <p className="text-sm">
        <Link href="/login" style={{ color: 'var(--color-accent)' }}>
          Back to login
        </Link>
      </p>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Image src="/logo.png" alt="Waiseka" width={48} height={48} priority className="rounded-xl" />
          <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
            WaiseKa
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Email verification</p>
      </div>
      <Card>
        <CardContent className="pt-6 pb-6">
          <Suspense fallback={<div className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>}>
            <VerifyEmailContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
