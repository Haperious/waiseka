'use client'

import { useState, useEffect } from 'react'
import { User, Lock, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import { useCurrency } from '@/context/CurrencyContext'
import { getAllCurrencies, CurrencyCode } from '@/lib/currency'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { currency, setCurrency, formatAmount } = useCurrency()
  const { toast } = useToast()
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

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        if (d?.name) setProfile({ name: d.name, avatar: d.avatar ?? '' })
        if (d?.preferences?.currency) setSelectedCurrency(d.preferences.currency)
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your account and preferences</p>
      </div>

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
    </div>
  )
}
