'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { User, Lock, DollarSign, Bell, Sun, Moon, Mic } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import { useCurrency } from '@/context/CurrencyContext'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'
import { getAllCurrencies, CurrencyCode } from '@/lib/currency'
import { useToast } from '@/components/ui/Toast'

type Frequency = 'daily' | 'weekly' | 'monthly'

// ── Reusable section card ────────────────────────────────────────────────────
function SettingsSection({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      borderRadius: 16,
      border: '1px solid var(--color-border)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          backgroundColor: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: 18, height: 18, color: iconColor }} />
        </div>
        <div>
          <h2 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
            {title}
          </h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 1 }}>
            {subtitle}
          </p>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: 44, height: 24,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-elevated)',
        transition: 'background-color 0.2s',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3, left: checked ? 23 : 3,
        width: 18, height: 18,
        borderRadius: '50%',
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { currency, setCurrency, formatAmount } = useCurrency()
  const { theme, setTheme } = useTheme()
  const { t } = useLanguage()
  const { toast } = useToast()
  const router = useRouter()
  const currencies = getAllCurrencies()

  const [profile, setProfile] = useState({ name: '', avatar: '' })
  const [profileLoading, setProfileLoading] = useState(false)

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency)
  const [currencyLoading, setCurrencyLoading] = useState(false)

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
        toast('Password updated. Please log in again.', 'success')
        // Force re-login so the old JWT (potentially stolen) is invalidated
        setTimeout(() => signOut({ callbackUrl: '/login' }), 1500)
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

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)',
  }

  const subLabelStyle: React.CSSProperties = {
    fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2,
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{
          fontSize: '1.6rem', fontWeight: 900,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-playfair), Georgia, serif',
          lineHeight: 1.1,
        }}>
          {t('settings.title')}
        </h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
          {t('settings.subtitle')}
        </p>
      </div>

      {/* ── Appearance ───────────────────────────────────────────────────────── */}
      <SettingsSection
        icon={theme === 'dark' ? Moon : Sun}
        iconColor="var(--color-accent)"
        iconBg="var(--color-sage)"
        title={t('settings.appearance')}
        subtitle={t('settings.appearanceSub')}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          {(['light', 'dark'] as const).map((mode) => {
            const isActive = theme === mode
            const Icon = mode === 'light' ? Sun : Moon
            return (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '16px 12px', borderRadius: 14,
                  border: isActive ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                  backgroundColor: isActive ? 'var(--color-sage)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <Icon style={{
                  width: 22, height: 22,
                  color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }} />
                <span style={{
                  fontSize: '0.82rem', fontWeight: 600,
                  color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}>
                  {mode === 'light' ? t('settings.light') : t('settings.dark')}
                </span>
              </button>
            )
          })}
        </div>
      </SettingsSection>

      {/* ── Profile ──────────────────────────────────────────────────────────── */}
      <SettingsSection
        icon={User}
        iconColor="var(--color-accent)"
        iconBg="var(--color-sage)"
        title={t('settings.profile')}
        subtitle={t('settings.profileSub')}
      >
        <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label={t('settings.fullName')}
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            placeholder="Your name"
          />
          <Input
            label={t('settings.avatarUrl')}
            value={profile.avatar}
            onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
            placeholder="https://..."
            type="url"
          />
          <Button type="submit" loading={profileLoading}>
            {t('settings.saveProfile')}
          </Button>
        </form>
      </SettingsSection>

      {/* ── Password ─────────────────────────────────────────────────────────── */}
      <SettingsSection
        icon={Lock}
        iconColor="var(--color-warning)"
        iconBg="var(--color-warning-bg)"
        title={t('settings.password')}
        subtitle={t('settings.passwordSub')}
      >
        <form onSubmit={handlePasswordSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PasswordInput
            label={t('settings.currentPassword')}
            value={passwords.currentPassword}
            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            error={passwordErrors.currentPassword}
            autoComplete="current-password"
          />
          <PasswordInput
            label={t('settings.newPassword')}
            value={passwords.newPassword}
            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
            error={passwordErrors.newPassword}
            autoComplete="new-password"
          />
          <PasswordInput
            label={t('settings.confirmPassword')}
            value={passwords.confirmPassword}
            onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
            error={passwordErrors.confirmPassword}
            autoComplete="new-password"
          />
          <Button type="submit" loading={passwordLoading}>
            {t('settings.updatePassword')}
          </Button>
        </form>
      </SettingsSection>

      {/* ── Currency ─────────────────────────────────────────────────────────── */}
      <SettingsSection
        icon={DollarSign}
        iconColor="var(--color-income)"
        iconBg="var(--color-income-bg)"
        title={t('settings.currency')}
        subtitle={t('settings.currencySub')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 10,
          }}>
            {currencies.map((c) => {
              const isActive = selectedCurrency === c.code
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelectedCurrency(c.code as CurrencyCode)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '14px 8px', borderRadius: 14,
                    border: isActive ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                    backgroundColor: isActive ? 'var(--color-sage)' : 'transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{c.flag}</span>
                  <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {c.code}
                  </p>
                  <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{c.label}</p>
                  <p style={{
                    fontSize: '0.92rem', fontWeight: 800,
                    color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  }}>
                    {c.symbol}
                  </p>
                </button>
              )
            })}
          </div>

          {selectedCurrency !== currency && (
            <p style={{
              fontSize: '0.78rem', color: 'var(--color-warning)',
              padding: '8px 12px', borderRadius: 8,
              backgroundColor: 'var(--color-warning-bg)',
            }}>
              Preview: {formatAmount(1500)} → amounts will display in {selectedCurrency}
            </p>
          )}

          <Button
            onClick={handleCurrencySave}
            loading={currencyLoading}
            disabled={selectedCurrency === currency}
          >
            {t('settings.saveCurrency')}
          </Button>
        </div>
      </SettingsSection>

      {/* ── Notifications ────────────────────────────────────────────────────── */}
      <SettingsSection
        icon={Bell}
        iconColor="var(--color-savings)"
        iconBg="var(--color-savings-bg)"
        title={t('settings.notifications')}
        subtitle={t('settings.notifSub')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Email toggle */}
          <div style={rowStyle}>
            <div>
              <p style={labelStyle}>{t('settings.emailReminders')}</p>
              <p style={subLabelStyle}>{t('settings.emailRemindersSub')}</p>
            </div>
            <Toggle checked={emailEnabled} onChange={setEmailEnabled} />
          </div>

          {/* Email count stepper */}
          {emailEnabled && (
            <div style={{
              padding: '14px 16px',
              borderRadius: 12,
              backgroundColor: 'var(--color-elevated)',
              border: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {t('settings.remindMe')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {[
                    { label: '−', action: () => setEmailCount((v) => Math.max(1, v - 1)), disabled: emailCount <= 1 },
                    { label: '+', action: () => setEmailCount((v) => Math.min(maxEmailCount, v + 1)), disabled: emailCount >= maxEmailCount },
                  ].map(({ label, action, disabled }, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={label === '−' ? action : action}
                      disabled={disabled}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-card)',
                        color: 'var(--color-text-primary)',
                        fontSize: '1.1rem', fontWeight: 600,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.35 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {i === 0 ? '−' : '+'}
                    </button>
                  ))}
                  <span style={{
                    width: 32, textAlign: 'center',
                    fontSize: '1rem', fontWeight: 800,
                    color: 'var(--color-text-primary)',
                  }}>
                    {emailCount}
                  </span>
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                  {t('settings.timePer')} {frequency} ({t('settings.max')} {maxEmailCount})
                </span>
              </div>
            </div>
          )}

          {/* Push toggle */}
          <div style={rowStyle}>
            <div>
              <p style={labelStyle}>{t('settings.pushNotifs')}</p>
              <p style={subLabelStyle}>{t('settings.pushNotifsSub')}</p>
            </div>
            <Toggle checked={pushEnabled} onChange={handlePushToggle} />
          </div>

          {/* Frequency select */}
          <div>
            <label style={{
              display: 'block', marginBottom: 8,
              fontSize: '0.78rem', fontWeight: 600,
              color: 'var(--color-text-primary)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {t('settings.reminderFreq')}
            </label>
            <select
              value={frequency}
              onChange={(e) => handleFrequencyChange(e.target.value as Frequency)}
              style={{
                width: '100%', height: 40,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-elevated)',
                color: 'var(--color-text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="daily">{t('settings.daily')}</option>
              <option value="weekly">{t('settings.weekly')}</option>
              <option value="monthly">{t('settings.monthly')}</option>
            </select>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
              {t('settings.freqSub')}
            </p>
          </div>

          <Button onClick={() => saveNotifications()} loading={notifLoading}>
            {t('settings.saveNotifs')}
          </Button>
        </div>
      </SettingsSection>

      {/* ── Voice Keywords ───────────────────────────────────────────────────── */}
      <SettingsSection
        icon={Mic}
        iconColor="var(--color-accent)"
        iconBg="var(--color-sage)"
        title={t('settings.voiceKeywords')}
        subtitle={t('settings.voiceKeywordsSub')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {t('settings.voiceMap')}
          </p>
          <Button variant="outline" onClick={() => router.push('/settings/voice-keywords')}>
            {t('settings.manageVoice')}
          </Button>
        </div>
      </SettingsSection>
    </div>
  )
}
