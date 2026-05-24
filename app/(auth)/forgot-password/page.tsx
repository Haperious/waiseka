'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required'); return }
    setLoading(true)
    setError('')
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Image src="/logo.png" alt="Waiseka" width={48} height={48} priority className="rounded-xl" />
          <span className="text-2xl font-bold text-gray-900 dark:text-white">WaiseKa</span>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Reset your password</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📬</div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Check your inbox</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If that email is registered, we've sent a reset link valid for 30 minutes.
              </p>
              <Link href="/login" className="text-sm text-blue-600 hover:underline font-medium">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter the email address you registered with and we'll send you a reset link.
              </p>
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error}
                autoComplete="email"
              />
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Send reset link
              </Button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                  Back to login
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
