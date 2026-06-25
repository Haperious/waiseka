'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import { Card, CardContent } from '@/components/ui/Card'
import { useTheme } from '@/context/ThemeContext'

export default function LoginPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
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

    if (result?.error) {
      setError('Invalid email or password')
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
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Image src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'} alt="Waiseka" width={48} height={48} priority className="rounded-xl" />
          <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>WaiseKa</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Sign in to your account</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="mt-1 text-right">
                <Link href="/forgot-password" className="text-xs hover:underline" style={{ color: 'var(--color-accent)' }}>
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>

          <p className="mt-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" className="hover:underline font-medium" style={{ color: 'var(--color-accent)' }}>
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
