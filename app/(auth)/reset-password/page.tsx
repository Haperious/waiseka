'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Button from '@/components/ui/Button'
import PasswordInput from '@/components/ui/PasswordInput'
import { Card, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'

function ResetPasswordForm() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">❌</div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Invalid reset link</p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          This link is missing or malformed. Request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm hover:underline font-medium" style={{ color: 'var(--color-accent)' }}>
          Request new link
        </Link>
      </div>
    )
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
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
        setErrors({ password: data.error })
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Choose a strong password - at least 8 characters.
      </p>
      <PasswordInput
        label="New password"
        placeholder="Min. 8 characters"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        error={errors.password}
      />
      <PasswordInput
        label="Confirm new password"
        placeholder="Repeat password"
        value={form.confirmPassword}
        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        error={errors.confirmPassword}
      />
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Set new password
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="hover:underline font-medium" style={{ color: 'var(--color-accent)' }}>
          Back to login
        </Link>
      </p>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Image src="/logo.png" alt="Waiseka" width={48} height={48} priority className="rounded-xl" />
          <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>WaiseKa</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Set a new password</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
