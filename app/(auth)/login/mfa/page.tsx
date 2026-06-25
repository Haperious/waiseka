'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useTheme } from '@/context/ThemeContext'
import { ShieldCheck } from 'lucide-react'

export default function MfaLoginPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [useBackup, setUseBackup] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // We use the current session to identify the user — the validate route reads session server-side
      const res = await fetch('/api/auth/mfa/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Invalid code. Please try again.')
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

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Image src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'} alt="Waiseka" width={48} height={48} priority className="rounded-xl" />
          <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>WaiseKa</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Two-factor authentication</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--color-pale)' }}>
              <ShieldCheck size={24} style={{ color: 'var(--color-accent)' }} />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
              {useBackup
                ? 'Enter one of your backup codes.'
                : 'Open your authenticator app and enter the 6-digit code.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                {useBackup ? 'Backup Code' : 'Authentication Code'}
              </label>
              <input
                ref={inputRef}
                type="text"
                inputMode={useBackup ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                placeholder={useBackup ? 'XXXX-XXXX' : '000000'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                maxLength={useBackup ? 9 : 6}
                required
                className="w-full rounded-lg px-4 py-2.5 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 transition-colors"
                style={{
                  backgroundColor: 'var(--color-elevated)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: '1.2rem',
                  letterSpacing: '0.25em',
                }}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Verify
            </Button>
          </form>

          <button
            type="button"
            onClick={() => { setUseBackup((v) => !v); setToken(''); setError('') }}
            className="mt-4 w-full text-center text-xs hover:underline"
            style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {useBackup ? 'Use authenticator app instead' : 'Use a backup code instead'}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
