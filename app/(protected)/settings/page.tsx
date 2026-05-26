'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Lock, DollarSign, Bell, Sun, Moon, Mic } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import { useCurrency } from '@/context/CurrencyContext'
import { useTheme } from '@/context/ThemeContext'
import { getAllCurrencies, CurrencyCode } from '@/lib/currency'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

type Frequency = 'daily' | 'weekly' | 'monthly'

export default function SettingsPage() {
  const { currency, setCurrency, formatAmount } = useCurrency()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const router = useRouter()
  const currencies = getAllCurrencies()

  // Profile
  const [profile, setProfile] = useState({ name: '', avatar: '' })
  const [profileLoading, setProfileLoading] = useState(false)

  // Password
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Currency
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency)
  const [currencyLoading, setCurrencyLoading] = useState(false)

  // Notifications
  const [notifLoading, setNotifLoading] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('weekly')
  const [emailCount, setEmailCount] = useState(1)

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        if (d?.name) setProfile({ name: d.name, avatar: d.avatar ?? '' })
        if (d?.preferences?.currency) setSelectedCurrency(d.preferences.currency)
      })
      .catch(() => {})

    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => {
        if (d?.email) setEmailEnabled(d.email.enabled ?? false)
        if (d?.push) setPushEnabled(d.push.enabled ?? false)
        if (d?.email?.frequency) setFrequency(d.email.frequency)
        else if (d?.push?.frequency) setFrequency(d.push.frequency)
        if (d?.email?.count) setEmailCount(d.email.count)
      })
      .catch(() => {})
  }, [])

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, avatar: profile.avatar || undefined }),
      })
      if (res.ok) {
        toast('Profile updated successfully', 'success')
      } else {
        const data = await res.json()
        toast(data.error ?? 'Failed to update profile', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setProfileLoading(false)
    }
  }

  const validatePasswords = () => {
    const e: Record<string, string> = {}
    if (!passwords.currentPassword) e.currentPassword = 'Current password is required'
    if (!passwords.newPassword) e.newPassword = 'New password is required'
    else if (passwords.newPassword.length < 8) e.newPassword = 'Must be at least 8 characters'
    if (!passwords.confirmPassword) e.confirmPassword = 'Please confirm new password'
    else if (passwords.newPassword !== passwords.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setPasswordErrors(e)
    return Object.keys(e).length === 0
  }

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validatePasswords()) return
    setPasswordLoading(true)
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwords),
      })
      const data = await res.json()
      if (res.ok) {
        toast('Password updated successfully', 'success')
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast(data.error ?? 'Failed to update password', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleCurrencySave = async () => {
    if (selectedCurrency === currency) return
    setCurrencyLoading(true)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: selectedCurrency }),
      })
      const data = await res.json()
      if (res.ok) {
        setCurrency(selectedCurrency)
        const info = currencies.find((c) => c.code === selectedCurrency)
        toast(`Currency updated to ${info?.label} ${info?.symbol}`, 'success')
      } else {
        toast(data.error ?? 'Failed to update currency', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setCurrencyLoading(false)
    }
  }

  const handlePushToggle = async (enabled: boolean) => {
    let fcmToken: string | null = null

    if (enabled && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast('Push permission denied. Please allow notifications in your browser.', 'error')
        return
      }
      // FCM token retrieval requires the Firebase client SDK.
      // Store null for now; configure FIREBASE_VAPID_KEY + firebase client SDK to enable.
      fcmToken = null
    }

    setPushEnabled(enabled)
    await saveNotifications({ push: { enabled, fcmToken } })
  }

  const maxEmailCount = frequency === 'daily' ? 5 : frequency === 'weekly' ? 7 : 30

  const handleFrequencyChange = (newFreq: Frequency) => {
    setFrequency(newFreq)
    const newMax = newFreq === 'daily' ? 5 : newFreq === 'weekly' ? 7 : 30
    setEmailCount((v) => Math.min(v, newMax))
  }

  const saveNotifications = async (overrides?: { push?: { enabled: boolean; fcmToken: string | null } }) => {
    setNotifLoading(true)
    try {
      const body: Record<string, unknown> = {
        email: { enabled: emailEnabled, frequency, count: emailCount },
        push: { enabled: pushEnabled, frequency },
      }
      if (overrides?.push !== undefined) {
        body.push = { ...body.push as object, ...overrides.push }
      }

      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast('Notification preferences saved', 'success')
      } else {
        const data = await res.json()
        toast(data.error ?? 'Failed to save notifications', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setNotifLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Manage your account and preferences</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader className="flex items-center gap-3 flex-row">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-elevated)' }}>
            {theme === 'dark' ? (
              <Moon className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
            ) : (
              <Sun className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
            )}
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Appearance</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Choose your display theme</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all'
              )}
              style={theme === 'light'
                ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-elevated)' }
                : { borderColor: 'var(--color-border)' }
              }
            >
              <Sun className="h-6 w-6" style={{ color: theme === 'light' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Light</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all'
              )}
              style={theme === 'dark'
                ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-elevated)' }
                : { borderColor: 'var(--color-border)' }
              }
            >
              <Moon className="h-6 w-6" style={{ color: theme === 'dark' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Dark</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader className="flex items-center gap-3 flex-row">
          <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Profile</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Update your name and avatar</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <Input
              label="Full Name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="Your name"
            />
            <Input
              label="Avatar URL (optional)"
              value={profile.avatar}
              onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
              placeholder="https://..."
              type="url"
            />
            <Button type="submit" loading={profileLoading}>Save Profile</Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader className="flex items-center gap-3 flex-row">
          <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Lock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Password</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Change your account password</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <PasswordInput
              label="Current Password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              error={passwordErrors.currentPassword}
              autoComplete="current-password"
            />
            <PasswordInput
              label="New Password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              error={passwordErrors.newPassword}
              autoComplete="new-password"
            />
            <PasswordInput
              label="Confirm New Password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              error={passwordErrors.confirmPassword}
              autoComplete="new-password"
            />
            <Button type="submit" loading={passwordLoading}>Update Password</Button>
          </form>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader className="flex items-center gap-3 flex-row">
          <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Currency</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Choose your display currency</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {currencies.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setSelectedCurrency(c.code as CurrencyCode)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left',
                  selectedCurrency === c.code
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <span className="text-3xl">{c.flag}</span>
                <div className="text-center">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{c.code}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
                  <p className="text-base text-blue-600 dark:text-blue-400 font-bold mt-0.5">{c.symbol}</p>
                </div>
              </button>
            ))}
          </div>

          {selectedCurrency !== currency && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Preview: {formatAmount(1500)} → amounts will display in {selectedCurrency}
            </p>
          )}

          <Button onClick={handleCurrencySave} loading={currencyLoading} disabled={selectedCurrency === currency}>
            Save Currency Preference
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="flex items-center gap-3 flex-row">
          <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Bell className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Notifications</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Reminders to log your expenses</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Email toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Email reminders</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Receive budget reminders by email</p>
            </div>
            <button
              type="button"
              onClick={() => setEmailEnabled((v) => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                emailEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              )}
              role="switch"
              aria-checked={emailEnabled}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                  emailEnabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Email count stepper (shown when email is enabled) */}
          {emailEnabled && (
            <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: 'var(--color-elevated)' }}>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Remind me</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEmailCount((v) => Math.max(1, v - 1))}
                    disabled={emailCount <= 1}
                    className="w-8 h-8 rounded-md border flex items-center justify-center text-lg font-medium transition-opacity disabled:opacity-30"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)' }}
                  >
                    –
                  </button>
                  <span className="w-8 text-center text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {emailCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEmailCount((v) => Math.min(maxEmailCount, v + 1))}
                    disabled={emailCount >= maxEmailCount}
                    className="w-8 h-8 rounded-md border flex items-center justify-center text-lg font-medium transition-opacity disabled:opacity-30"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)' }}
                  >
                    +
                  </button>
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    time{emailCount !== 1 ? 's' : ''} per {frequency} (max {maxEmailCount})
                  </span>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Reminders: <strong>{emailCount}× {frequency}</strong>
              </p>
            </div>
          )}

          {/* Push toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Push notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Browser push alerts (requires permission)</p>
            </div>
            <button
              type="button"
              onClick={() => handlePushToggle(!pushEnabled)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                pushEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              )}
              role="switch"
              aria-checked={pushEnabled}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                  pushEnabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">
              Reminder frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => handleFrequencyChange(e.target.value as Frequency)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Applies to both email and push notifications</p>
          </div>

          <Button onClick={() => saveNotifications()} loading={notifLoading}>
            Save Notification Preferences
          </Button>
        </CardContent>
      </Card>

      {/* Voice Keywords */}
      <Card>
        <CardHeader className="flex items-center gap-3 flex-row">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <Mic className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Voice Keywords</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Custom keywords for voice input</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Map spoken words to transaction categories for faster voice entry.
          </p>
          <Button variant="outline" onClick={() => router.push('/settings/voice-keywords')}>
            Manage Voice Keywords
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
