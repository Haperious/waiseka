'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  User, Shield, Wallet, Bell, Sun, Mic, Moon,
  ShieldCheck, ShieldOff, Copy, Eye, EyeOff,
  Plus, X, PieChart, Tags, ArrowUpRight,
  Search, Pencil, Trash2,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import PasswordInput from '@/components/ui/PasswordInput'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { useCurrency } from '@/context/CurrencyContext'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'
import { getAllCurrencies, CurrencyCode } from '@/lib/currency'
import { useToast } from '@/components/ui/Toast'
import { useAccounts } from '@/hooks/useAccounts'
import { useVoiceKeywords, VoiceKeyword } from '@/hooks/useVoiceKeywords'
import { useCategories } from '@/hooks/useCategories'
import { useSession, signOut } from 'next-auth/react'
import { isPremium } from '@/lib/tier'
import { cn } from '@/lib/utils'
import styles from './settings.module.css'

const VOICE_TYPE_OPTIONS = [
  { value: 'any', label: 'Any type' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'savings', label: 'Savings' },
]

type Frequency = 'daily' | 'weekly' | 'monthly'
type TabId = 'account' | 'security' | 'money' | 'notifs' | 'display' | 'voice'

const TAB_IDS: TabId[] = ['account', 'security', 'money', 'notifs', 'display', 'voice']

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

// ── Selection card (theme / reports view / currency / cutoff mode) ──────────
function selectionCardStyle(isActive: boolean): React.CSSProperties {
  return {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '16px 12px', borderRadius: 14,
    border: isActive ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
    backgroundColor: isActive ? 'var(--color-sage)' : 'transparent',
    cursor: 'pointer', transition: 'all 0.15s',
  }
}

const numberInputStyle: React.CSSProperties = {
  width: 48, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700,
  color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card)',
  border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 4px',
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { currency, setCurrency, formatAmount } = useCurrency()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { toast } = useToast()
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currencies = getAllCurrencies()
  const isVerified = session?.user?.isVerified ?? true
  const userIsPremium = session?.user ? isPremium(session.user as { tier: string; premiumOverride: boolean }) : false

  // ── Tab state, driven by ?tab= ────────────────────────────────────────────
  const requestedTab = searchParams.get('tab')
  const activeTab: TabId = (TAB_IDS as string[]).includes(requestedTab ?? '') ? (requestedTab as TabId) : 'account'
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const setActiveTab = useCallback((id: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', id)
    router.replace(`/settings?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % TAB_IDS.length
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + TAB_IDS.length) % TAB_IDS.length
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = TAB_IDS.length - 1
    if (nextIndex !== null) {
      e.preventDefault()
      const nextId = TAB_IDS[nextIndex]
      setActiveTab(nextId)
      tabRefs.current[nextId]?.focus()
    }
  }

  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  const handleResendVerification = async () => {
    setResendLoading(true)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      if (res.ok) {
        setResendSent(true)
        toast('Verification email sent! Check your inbox.', 'success')
      } else {
        const data = await res.json()
        toast(data.error ?? 'Failed to send verification email', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setResendLoading(false)
    }
  }

  const [profile, setProfile] = useState({ name: '', avatar: '' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [aiUsage, setAiUsage] = useState<{ queriesUsed: number; cap: number | null } | null>(null)

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency)
  const [currencyLoading, setCurrencyLoading] = useState(false)

  const [reportsDefaultView, setReportsDefaultView] = useState<'chart' | 'table'>('chart')
  const [reportsViewLoading, setReportsViewLoading] = useState(false)

  const { accounts } = useAccounts()
  const activeAccounts = accounts.filter((a) => !a.isArchived)
  const [defaultAccountId, setDefaultAccountId] = useState<string>('')
  const [savedDefaultAccountId, setSavedDefaultAccountId] = useState<string>('')
  const [defaultAccountLoading, setDefaultAccountLoading] = useState(false)

  type CutoffMode = 'semi-monthly' | 'monthly' | 'custom'
  const [cutoffMode, setCutoffMode] = useState<CutoffMode>('semi-monthly')
  const [cutoffMidDay, setCutoffMidDay] = useState(15)
  const [customCutoffDays, setCustomCutoffDays] = useState<number[]>([10, 20])
  const [savedCutoff, setSavedCutoff] = useState<{ mode: CutoffMode; midDay: number; customDays: number[] }>({
    mode: 'semi-monthly', midDay: 15, customDays: [10, 20],
  })
  const [cutoffLoading, setCutoffLoading] = useState(false)

  const [notifLoading, setNotifLoading] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('weekly')
  const [emailCount, setEmailCount] = useState(1)

  // ── Voice keywords state ─────────────────────────────────────────────────
  const { keywords: voiceKeywords, addKeyword: addVoiceKeyword, removeKeyword: removeVoiceKeyword } = useVoiceKeywords()
  const { categories } = useCategories()
  const [voiceSearch, setVoiceSearch] = useState('')
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [editingVoiceKeyword, setEditingVoiceKeyword] = useState<string | null>(null)
  const [voiceForm, setVoiceForm] = useState({ keyword: '', category: '', type: 'any' })
  const [voiceFormError, setVoiceFormError] = useState('')

  const voiceCategoryOptions = categories.map((c) => ({ value: c.name, label: c.name }))

  const filteredVoiceKeywords = voiceSearch
    ? voiceKeywords.filter(
        (k) =>
          k.keyword.toLowerCase().includes(voiceSearch.toLowerCase()) ||
          k.category.toLowerCase().includes(voiceSearch.toLowerCase())
      )
    : voiceKeywords

  const openAddVoiceModal = () => {
    setEditingVoiceKeyword(null)
    setVoiceForm({ keyword: '', category: '', type: 'any' })
    setVoiceFormError('')
    setVoiceModalOpen(true)
  }

  const openEditVoiceModal = (kw: VoiceKeyword) => {
    setEditingVoiceKeyword(kw.keyword)
    setVoiceForm({ keyword: kw.keyword, category: kw.category, type: kw.type ?? 'any' })
    setVoiceFormError('')
    setVoiceModalOpen(true)
  }

  const closeVoiceModal = () => {
    setVoiceModalOpen(false)
    setVoiceFormError('')
  }

  const handleVoiceSave = () => {
    const trimmed = voiceForm.keyword.trim()
    if (!trimmed) { setVoiceFormError('Enter a keyword phrase'); return }
    if (!voiceForm.category) { setVoiceFormError('Select a category'); return }
    if (editingVoiceKeyword && editingVoiceKeyword !== trimmed.toLowerCase()) {
      removeVoiceKeyword(editingVoiceKeyword)
    }
    addVoiceKeyword(trimmed, voiceForm.category, (voiceForm.type === 'any' ? undefined : voiceForm.type) as 'income' | 'expense' | 'savings' | undefined)
    setVoiceModalOpen(false)
  }

  const handleVoiceDelete = (keyword: string) => {
    if (!window.confirm(`Delete keyword "${keyword}"?`)) return
    removeVoiceKeyword(keyword)
  }

  const voiceTypeBadgeVariant = (type?: string) => {
    if (type === 'income') return 'success'
    if (type === 'expense') return 'danger'
    if (type === 'savings') return 'savings'
    return 'default'
  }

  // ── MFA state ───────────────────────────────────────────────────────────────
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'backup-codes' | 'disable'>('idle')
  const [mfaQr, setMfaQr] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaWorking, setMfaWorking] = useState(false)
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([])
  const [showSecret, setShowSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        if (d?.name) setProfile({ name: d.name, avatar: d.avatar ?? '' })
        if (d?.preferences?.currency) setSelectedCurrency(d.preferences.currency)
        if (d?.preferences?.reportsDefaultView) setReportsDefaultView(d.preferences.reportsDefaultView)
        if (d?.preferences?.defaultAccountId) {
          setDefaultAccountId(d.preferences.defaultAccountId)
          setSavedDefaultAccountId(d.preferences.defaultAccountId)
        }
        if (d?.ai) setAiUsage({ queriesUsed: d.ai.queriesUsed ?? 0, cap: d.ai.queriesCapOverride ?? null })
        const mode: CutoffMode = d?.preferences?.cutoffMode ?? 'semi-monthly'
        const days: number[] = d?.preferences?.cutoffDays ?? [15, 30]
        const midDay = days.find((day: number) => day < 30) ?? 15
        const customDays = mode === 'custom' ? days : [10, 20]
        setCutoffMode(mode)
        setCutoffMidDay(midDay)
        setCustomCutoffDays(customDays)
        setSavedCutoff({ mode, midDay, customDays })
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

    fetch('/api/auth/mfa/status')
      .then((r) => r.json())
      .then((d) => { setMfaEnabled(d.enabled ?? false) })
      .catch(() => {})
      .finally(() => setMfaLoading(false))
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

  const handleReportsDefaultViewChange = async (next: 'chart' | 'table') => {
    if (next === reportsDefaultView) return
    const prev = reportsDefaultView
    setReportsDefaultView(next)
    setReportsViewLoading(true)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportsDefaultView: next }),
      })
      if (!res.ok) {
        const data = await res.json()
        setReportsDefaultView(prev)
        toast(data.error ?? 'Failed to update default report view', 'error')
      }
    } catch {
      setReportsDefaultView(prev)
      toast('Something went wrong', 'error')
    } finally {
      setReportsViewLoading(false)
    }
  }

  const handleDefaultAccountSave = async () => {
    if (defaultAccountId === savedDefaultAccountId) return
    setDefaultAccountLoading(true)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultAccountId: defaultAccountId || null }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavedDefaultAccountId(defaultAccountId)
        toast('Default account updated', 'success')
      } else {
        toast(data.error ?? 'Failed to update default account', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setDefaultAccountLoading(false)
    }
  }

  const resolvedCutoffDays = (mode: CutoffMode) =>
    mode === 'monthly' ? [30] : mode === 'semi-monthly' ? [cutoffMidDay, 30] : customCutoffDays

  const isCutoffDirty =
    cutoffMode !== savedCutoff.mode ||
    (cutoffMode === 'semi-monthly' && cutoffMidDay !== savedCutoff.midDay) ||
    (cutoffMode === 'custom' &&
      (customCutoffDays.length !== savedCutoff.customDays.length ||
        customCutoffDays.some((d, i) => d !== savedCutoff.customDays[i])))

  const handleCutoffSave = async () => {
    const days = resolvedCutoffDays(cutoffMode)
    if (cutoffMode === 'custom' && days.length === 0) {
      toast('Add at least one cutoff day', 'error')
      return
    }
    setCutoffLoading(true)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cutoffMode, cutoffDays: days }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavedCutoff({ mode: cutoffMode, midDay: cutoffMidDay, customDays: cutoffMode === 'custom' ? days : customCutoffDays })
        toast('Cutoff schedule updated', 'success')
      } else {
        toast(data.error ?? 'Failed to update cutoff schedule', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setCutoffLoading(false)
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

  // ── MFA handlers ──────────────────────────────────────────────────────────
  const handleMfaSetupStart = async () => {
    setMfaError('')
    setMfaWorking(true)
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start MFA setup')
      setMfaQr(data.qrDataUrl)
      setMfaSecret(data.manualEntryKey)
      setMfaToken('')
      setMfaStep('setup')
    } catch (err: unknown) {
      setMfaError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setMfaWorking(false)
    }
  }

  const handleMfaVerify = async () => {
    if (!mfaToken || mfaToken.length !== 6) {
      setMfaError('Enter the 6-digit code from your authenticator app')
      return
    }
    setMfaError('')
    setMfaWorking(true)
    try {
      const res = await fetch('/api/auth/mfa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Verification failed')
      setMfaBackupCodes(data.backupCodes)
      setMfaEnabled(true)
      setMfaStep('backup-codes')
    } catch (err: unknown) {
      setMfaError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setMfaWorking(false)
    }
  }

  const handleMfaDisable = async () => {
    if (!mfaToken) {
      setMfaError('Enter your current TOTP code to disable MFA')
      return
    }
    setMfaError('')
    setMfaWorking(true)
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to disable MFA')
      setMfaEnabled(false)
      setMfaStep('idle')
      setMfaToken('')
      toast('Two-factor authentication disabled', 'success')
    } catch (err: unknown) {
      setMfaError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setMfaWorking(false)
    }
  }

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(mfaBackupCodes.join('\n'))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  // ── Tab metadata ──────────────────────────────────────────────────────────
  const tabMeta: Record<TabId, { label: string; icon: React.ElementType; sub: string; count: number }> = useMemo(() => ({
    account: { label: t('settings.tab.account'), icon: User, sub: 'Your profile and account status', count: 3 },
    security: { label: t('settings.tab.security'), icon: Shield, sub: 'Keep your account protected', count: 2 },
    money: { label: t('settings.tab.money'), icon: Wallet, sub: 'Currency, default account and cutoff schedule', count: 3 },
    notifs: { label: t('settings.tab.notifs'), icon: Bell, sub: t('settings.notifSub'), count: 2 },
    display: { label: t('settings.tab.display'), icon: Sun, sub: 'How WaiseKa looks and opens', count: 3 },
    voice: { label: t('settings.tab.voice'), icon: Mic, sub: t('settings.voiceKeywordsSub'), count: 1 },
  }), [t])

  const activeMeta = tabMeta[activeTab]

  return (
    <div className={styles.page}>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className={styles.title}>{t('settings.title')}</h1>
        <p className={styles.subtitle}>{t('settings.subtitle')}</p>
      </div>

      {/* ── Tab strip ────────────────────────────────────────────────────────── */}
      <div className={styles.tabStrip} role="tablist" aria-label={t('settings.title')}>
        {TAB_IDS.map((id, index) => {
          const meta = tabMeta[id]
          const Icon = meta.icon
          const isActive = id === activeTab
          return (
            <button
              key={id}
              ref={(el) => { tabRefs.current[id] = el }}
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={isActive}
              aria-controls={`settings-panel-${id}`}
              tabIndex={isActive ? 0 : -1}
              className={cn(styles.tab, isActive && styles.tabActive)}
              onClick={() => setActiveTab(id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
            >
              <Icon className={styles.tabIcon} />
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* ── Panel ────────────────────────────────────────────────────────────── */}
      <div
        className={styles.panel}
        role="tabpanel"
        id={`settings-panel-${activeTab}`}
        aria-labelledby={`settings-tab-${activeTab}`}
        tabIndex={0}
      >
        <div className={styles.panelHeader}>
          <div className={styles.panelIconTile}>
            <activeMeta.icon />
          </div>
          <div className={styles.panelHeaderText}>
            <h2 className={styles.panelTitle}>{activeMeta.label}</h2>
            <p className={styles.panelSub}>{activeMeta.sub}</p>
          </div>
          <span className={styles.panelBadge}>{activeMeta.count} SETTINGS</span>
        </div>

        <div className={styles.panelBody}>

          {/* ══ ACCOUNT ══════════════════════════════════════════════════════ */}
          {activeTab === 'account' && (
            <>
              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>{t('settings.profile')}</p>
                <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className={cn(styles.fieldGrid)}>
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
                  </div>
                  <div>
                    <Button type="submit" loading={profileLoading}>
                      {t('settings.saveProfile')}
                    </Button>
                  </div>
                </form>
              </div>

              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>Email verification</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: isVerified ? 'var(--color-income)' : 'var(--color-warning)',
                    }} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                      {isVerified
                        ? 'Your email address has been verified.'
                        : 'Your email address has not been verified yet.'}
                    </p>
                  </div>
                  {!isVerified && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={resendLoading}
                      disabled={resendSent}
                      onClick={handleResendVerification}
                    >
                      {resendSent ? 'Email sent!' : 'Resend verification email'}
                    </Button>
                  )}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>Plan</p>
                <div className={styles.row}>
                  <div>
                    <p className={styles.rowLabel}>{userIsPremium ? 'Premium' : 'Free plan'}</p>
                    <p className={styles.rowSub}>
                      {userIsPremium
                        ? aiUsage
                          ? `${aiUsage.queriesUsed}${aiUsage.cap ? ` / ${aiUsage.cap}` : ''} AI queries used this period`
                          : 'AI-powered insights are unlocked on your account'
                        : 'Upgrade to unlock AI insights and longer report history'}
                    </p>
                  </div>
                  <div className={styles.rowControl}>
                    {!userIsPremium && (
                      <Button size="sm" variant="outline" onClick={() => router.push('/premium')}>
                        Upgrade <ArrowUpRight size={14} style={{ marginLeft: 4 }} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══ SECURITY ═════════════════════════════════════════════════════ */}
          {activeTab === 'security' && (
            <>
              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>{t('settings.password')}</p>
                <form onSubmit={handlePasswordSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className={cn(styles.fieldGrid, styles.passwordStack)} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
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
                  </div>
                  <div>
                    <Button type="submit" loading={passwordLoading}>
                      {t('settings.updatePassword')}
                    </Button>
                  </div>
                </form>
              </div>

              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>Two-factor authentication</p>
                {mfaLoading ? (
                  <div style={{ height: 32, width: 128, borderRadius: 8, backgroundColor: 'var(--color-border)' }} />
                ) : mfaStep === 'idle' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className={styles.row}>
                      <div>
                        <p className={styles.rowLabel}>Authenticator App (TOTP)</p>
                        <p className={styles.rowSub}>
                          {mfaEnabled
                            ? 'Two-factor authentication is enabled on your account.'
                            : 'Use Google Authenticator, Microsoft Authenticator, or any TOTP app.'}
                        </p>
                      </div>
                      <div className={styles.rowControl}>
                        {mfaEnabled ? (
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 600,
                            padding: '4px 10px', borderRadius: 999, backgroundColor: 'var(--color-income-bg)', color: 'var(--color-income)',
                          }}>
                            <ShieldCheck size={13} /> Enabled
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {mfaError && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--color-expense)' }}>{mfaError}</p>
                    )}
                    {mfaEnabled ? (
                      <div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => { setMfaStep('disable'); setMfaToken(''); setMfaError('') }}
                        >
                          <ShieldOff size={14} style={{ marginRight: 6 }} />
                          Disable MFA
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Button size="sm" onClick={handleMfaSetupStart} loading={mfaWorking}>
                          <ShieldCheck size={14} style={{ marginRight: 6 }} />
                          Enable MFA
                        </Button>
                      </div>
                    )}
                  </div>
                ) : mfaStep === 'setup' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.
                    </p>
                    {mfaQr && (
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mfaQr} alt="MFA QR Code" width={180} height={180} style={{ borderRadius: 12, border: '1px solid var(--color-border)' }} />
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: '0.72rem', fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                        Can&apos;t scan? Enter this key manually:
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code
                          style={{
                            flex: 1, borderRadius: 10, padding: '8px 12px', fontSize: '0.72rem', fontFamily: 'monospace', letterSpacing: '0.15em',
                            backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
                          }}
                        >
                          {showSecret ? mfaSecret : '•'.repeat(mfaSecret.length)}
                        </code>
                        <button type="button" onClick={() => setShowSecret((v) => !v)} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                          {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 500, marginBottom: 6, color: 'var(--color-text-primary)' }}>
                        6-digit code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={mfaToken}
                        onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                        style={{
                          width: '100%', borderRadius: 10, padding: '10px 16px', textAlign: 'center',
                          fontFamily: 'monospace', letterSpacing: '0.2em', fontSize: '1.2rem', outline: 'none',
                          backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
                        }}
                      />
                    </div>
                    {mfaError && <p style={{ fontSize: '0.82rem', color: 'var(--color-expense)' }}>{mfaError}</p>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" onClick={handleMfaVerify} loading={mfaWorking} disabled={mfaToken.length !== 6}>
                        Verify &amp; Enable
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setMfaStep('idle'); setMfaError('') }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : mfaStep === 'backup-codes' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={18} style={{ color: 'var(--color-income)' }} />
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                        MFA enabled! Save your backup codes.
                      </p>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      These codes can be used to access your account if you lose your authenticator. Each code can only be used once. Store them somewhere safe.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {mfaBackupCodes.map((code) => (
                        <code key={code} style={{ borderRadius: 10, padding: '8px 12px', fontSize: '0.72rem', fontFamily: 'monospace', textAlign: 'center', backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                          {code}
                        </code>
                      ))}
                    </div>
                    <div>
                      <Button size="sm" variant="outline" onClick={handleCopyBackupCodes}>
                        <Copy size={13} style={{ marginRight: 6 }} />
                        {copiedCodes ? 'Copied!' : 'Copy all codes'}
                      </Button>
                    </div>
                    <div>
                      <Button size="sm" onClick={() => { setMfaStep('idle'); setMfaBackupCodes([]) }}>
                        I&apos;ve saved these codes
                      </Button>
                    </div>
                  </div>
                ) : mfaStep === 'disable' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      Enter your current 6-digit TOTP code to confirm disabling MFA.
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={mfaToken}
                      onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                      style={{
                        width: '100%', borderRadius: 10, padding: '10px 16px', textAlign: 'center',
                        fontFamily: 'monospace', letterSpacing: '0.2em', fontSize: '1.2rem', outline: 'none',
                        backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
                      }}
                    />
                    {mfaError && <p style={{ fontSize: '0.82rem', color: 'var(--color-expense)' }}>{mfaError}</p>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="danger" onClick={handleMfaDisable} loading={mfaWorking} disabled={mfaToken.length !== 6}>
                        Confirm Disable
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setMfaStep('idle'); setMfaError(''); setMfaToken('') }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {/* ══ MONEY SETUP ══════════════════════════════════════════════════ */}
          {activeTab === 'money' && (
            <>
              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>{t('settings.currency')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${currencies.length}, 1fr)`, gap: 10 }}>
                    {currencies.map((c) => {
                      const isActive = selectedCurrency === c.code
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setSelectedCurrency(c.code as CurrencyCode)}
                          style={selectionCardStyle(isActive)}
                        >
                          <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{c.flag}</span>
                          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.code}</p>
                          <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{c.label}</p>
                          <p style={{ fontSize: '0.92rem', fontWeight: 800, color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                            {c.symbol}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    Amounts show as entered. WaiseKa never converts.
                  </p>
                  {selectedCurrency !== currency && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-warning)', padding: '8px 12px', borderRadius: 8, backgroundColor: 'var(--color-warning-bg)' }}>
                      Preview: {formatAmount(1500)} &rarr; amounts will display in {selectedCurrency}
                    </p>
                  )}
                  <div>
                    <Button onClick={handleCurrencySave} loading={currencyLoading} disabled={selectedCurrency === currency}>
                      {t('settings.saveCurrency')}
                    </Button>
                  </div>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>Default account</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    Pre-selected when you log a transaction.
                  </p>
                  {activeAccounts.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      Add an account first to set a default.
                    </p>
                  ) : (
                    <>
                      <Select
                        value={defaultAccountId}
                        onValueChange={setDefaultAccountId}
                        options={activeAccounts.map((a) => ({ value: a._id, label: a.name }))}
                        placeholder="Select an account"
                        className={styles.selectFull}
                      />
                      <div>
                        <Button onClick={handleDefaultAccountSave} loading={defaultAccountLoading} disabled={defaultAccountId === savedDefaultAccountId}>
                          Save Default Account
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>Sweldo cutoff</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {([
                      { mode: 'semi-monthly', label: 'Semi-monthly', hint: 'Twice a month' },
                      { mode: 'monthly', label: 'Monthly', hint: 'Once a month' },
                      { mode: 'custom', label: 'Custom', hint: 'Up to 4 cutoffs' },
                    ] as const).map(({ mode, label, hint }) => {
                      const isActive = cutoffMode === mode
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setCutoffMode(mode)}
                          style={{ ...selectionCardStyle(isActive), minWidth: 100, flex: '1 1 100px' }}
                        >
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                            {label}
                          </span>
                          <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)' }}>{hint}</span>
                        </button>
                      )
                    })}
                  </div>

                  {cutoffMode === 'semi-monthly' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>Mid-month cutoff on day</span>
                      <input
                        type="number"
                        min={1}
                        max={29}
                        value={cutoffMidDay}
                        onChange={(e) => setCutoffMidDay(Math.min(29, Math.max(1, Number(e.target.value) || 1)))}
                        style={numberInputStyle}
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>then again at month end</span>
                    </div>
                  )}

                  {cutoffMode === 'monthly' && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                      One period per month, resetting on the last day.
                    </p>
                  )}

                  {cutoffMode === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                        Periods always stay within a calendar month, but you can add up to 4 cutoff days for a
                        closer-to-weekly rhythm - e.g. 7 / 14 / 21 / 28.
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {customCutoffDays.map((day, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)',
                              borderRadius: 10, padding: '4px 6px',
                            }}
                          >
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={day}
                              onChange={(e) => {
                                const v = Math.min(31, Math.max(1, Number(e.target.value) || 1))
                                setCustomCutoffDays((days) => days.map((d, idx) => (idx === i ? v : d)))
                              }}
                              style={numberInputStyle}
                            />
                            <button
                              type="button"
                              onClick={() => setCustomCutoffDays((days) => days.filter((_, idx) => idx !== i))}
                              style={{ color: 'var(--color-text-muted)', display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                              aria-label="Remove cutoff day"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {customCutoffDays.length < 4 && (
                          <button
                            type="button"
                            onClick={() => setCustomCutoffDays((days) => [...days, 30])}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600,
                              color: 'var(--color-accent)', border: '1px dashed var(--color-border)', borderRadius: 10,
                              padding: '6px 10px', backgroundColor: 'transparent', cursor: 'pointer',
                            }}
                          >
                            <Plus size={14} /> Add day
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomCutoffDays([7, 14, 21, 28])}
                        style={{
                          alignSelf: 'flex-start', fontSize: '0.74rem', fontWeight: 600,
                          color: 'var(--color-text-secondary)', textDecoration: 'underline',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        }}
                      >
                        Use weekly preset (7 / 14 / 21 / 28)
                      </button>
                    </div>
                  )}

                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    3 days before a recurring bill lands, WaiseKa uses this schedule to reset your safe-to-spend total.
                  </p>

                  <div>
                    <Button onClick={handleCutoffSave} loading={cutoffLoading} disabled={!isCutoffDirty}>
                      Save Cutoff Schedule
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══ NOTIFICATIONS ════════════════════════════════════════════════ */}
          {activeTab === 'notifs' && (
            <>
              <div className={styles.fieldGroup}>
                <div className={styles.row}>
                  <div>
                    <p className={styles.rowLabel}>{t('settings.emailReminders')}</p>
                    <p className={styles.rowSub}>{t('settings.emailRemindersSub')}</p>
                  </div>
                  <div className={styles.rowControl}>
                    <Toggle checked={emailEnabled} onChange={setEmailEnabled} />
                  </div>
                </div>

                {emailEnabled && (
                  <div style={{
                    marginTop: 4, padding: '14px 16px', borderRadius: 12,
                    backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {t('settings.remindMe')}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['daily', 'weekly', 'monthly'] as Frequency[]).map((freq) => (
                          <button
                            key={freq}
                            type="button"
                            onClick={() => handleFrequencyChange(freq)}
                            style={{
                              padding: '6px 12px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 600,
                              border: frequency === freq ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                              backgroundColor: frequency === freq ? 'var(--color-sage)' : 'transparent',
                              color: frequency === freq ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            {freq === 'daily' ? t('settings.daily') : freq === 'weekly' ? t('settings.weekly') : t('settings.monthly')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setEmailCount((v) => Math.max(1, v - 1))}
                          disabled={emailCount <= 1}
                          style={{
                            width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-card)', color: 'var(--color-text-primary)',
                            fontSize: '1.1rem', fontWeight: 600, cursor: emailCount <= 1 ? 'not-allowed' : 'pointer',
                            opacity: emailCount <= 1 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          &minus;
                        </button>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)', minWidth: 24, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                          {emailCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEmailCount((v) => Math.min(maxEmailCount, v + 1))}
                          disabled={emailCount >= maxEmailCount}
                          style={{
                            width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-card)', color: 'var(--color-text-primary)',
                            fontSize: '1.1rem', fontWeight: 600, cursor: emailCount >= maxEmailCount ? 'not-allowed' : 'pointer',
                            opacity: emailCount >= maxEmailCount ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          +
                        </button>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                        {t('settings.timesPerFreq')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.row}>
                  <div>
                    <p className={styles.rowLabel}>{t('settings.pushNotifs')}</p>
                    <p className={styles.rowSub}>{t('settings.pushNotifsSub')}</p>
                  </div>
                  <div className={styles.rowControl}>
                    <Toggle checked={pushEnabled} onChange={handlePushToggle} />
                  </div>
                </div>
              </div>

            </>
          )}

          {/* ══ DISPLAY ══════════════════════════════════════════════════════ */}
          {activeTab === 'display' && (
            <>
              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>{t('settings.appearance')}</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['light', 'dark'] as const).map((mode) => {
                    const isActive = theme === mode
                    const Icon = mode === 'light' ? Sun : Moon
                    return (
                      <button key={mode} onClick={() => setTheme(mode)} style={selectionCardStyle(isActive)}>
                        <Icon style={{ width: 22, height: 22, color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                          {mode === 'light' ? t('settings.light') : t('settings.dark')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>Reports View</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.45 }}>
                  Choose what the Monthly Report opens to by default.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['chart', 'table'] as const).map((mode) => {
                    const isActive = reportsDefaultView === mode
                    const Icon = mode === 'chart' ? PieChart : Tags
                    return (
                      <button
                        key={mode}
                        onClick={() => handleReportsDefaultViewChange(mode)}
                        disabled={reportsViewLoading}
                        style={{ ...selectionCardStyle(isActive), opacity: reportsViewLoading ? 0.7 : 1, cursor: reportsViewLoading ? 'default' : 'pointer' }}
                      >
                        <Icon style={{ width: 22, height: 22, color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                          {mode === 'chart' ? 'Chart' : 'Table'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <p className={styles.groupLabel}>{t('settings.language')}</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['en', 'tl'] as const).map((lang) => {
                    const isActive = language === lang
                    return (
                      <button key={lang} onClick={() => setLanguage(lang)} style={selectionCardStyle(isActive)}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                          {lang === 'en' ? 'English' : 'Tagalog'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* ══ VOICE ════════════════════════════════════════════════════════ */}
          {activeTab === 'voice' && (
            <div className={styles.fieldGroup}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <p className={styles.groupLabel} style={{ marginBottom: 4 }}>{t('settings.voiceKeywords')}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {t('settings.voiceMap')}
                  </p>
                </div>
                <Button size="sm" onClick={openAddVoiceModal}>
                  <Plus className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">{t('settings.addVoiceKeyword')}</span>
                </Button>
              </div>

              {voiceKeywords.length > 3 && (
                <div className="relative" style={{ marginBottom: 14 }}>
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: 'var(--color-text-muted)' }}
                  />
                  <input
                    className="w-full pl-9 pr-9 h-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                    }}
                    placeholder="Search keywords..."
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                  />
                  {voiceSearch && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setVoiceSearch('')}
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {voiceKeywords.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <Mic className="h-9 w-9 mx-auto opacity-30" style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>No voice keywords yet.</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Add your first keyword to get started.</p>
                </div>
              ) : filteredVoiceKeywords.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    No results for &ldquo;{voiceSearch}&rdquo;
                  </p>
                  <button
                    className="text-xs underline"
                    style={{ color: 'var(--color-accent)', marginTop: 4 }}
                    onClick={() => setVoiceSearch('')}
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                  {filteredVoiceKeywords.map((kw, i) => (
                    <div
                      key={kw.keyword}
                      className="flex items-center gap-3"
                      style={{
                        padding: '12px 16px',
                        borderTop: i !== 0 ? '1px solid var(--color-border)' : 'none',
                      }}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {kw.keyword}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)' }}>&rarr;</span>
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {kw.category}
                        </span>
                        {kw.type && (
                          <Badge variant={voiceTypeBadgeVariant(kw.type)}>
                            {kw.type.charAt(0).toUpperCase() + kw.type.slice(1)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditVoiceModal(kw)}
                          className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                          style={{ color: 'var(--color-text-secondary)' }}
                          aria-label="Edit keyword"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleVoiceDelete(kw.keyword)}
                          className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                          style={{ color: 'var(--color-expense)' }}
                          aria-label="Delete keyword"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {activeTab === 'notifs' && (
          <div className={styles.footer}>
            <p className={styles.footerHelper}>Applies to both email and push reminders.</p>
            <Button onClick={() => saveNotifications()} loading={notifLoading}>
              {t('settings.saveNotifs')}
            </Button>
          </div>
        )}
      </div>

      {/* ── Voice keyword add/edit modal ─────────────────────────────────────── */}
      <Modal
        open={voiceModalOpen}
        onClose={closeVoiceModal}
        title={editingVoiceKeyword ? 'Edit Keyword' : 'New Keyword'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Keyword phrase"
            placeholder="e.g. palabok, rice, coffee"
            value={voiceForm.keyword}
            onChange={(e) => { setVoiceForm({ ...voiceForm, keyword: e.target.value }); setVoiceFormError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVoiceSave() } }}
          />
          <Select
            label="Category"
            value={voiceForm.category}
            onValueChange={(v) => { setVoiceForm({ ...voiceForm, category: v }); setVoiceFormError('') }}
            options={voiceCategoryOptions}
            placeholder="Select category"
          />
          <Select
            label="Transaction type (optional)"
            value={voiceForm.type}
            onValueChange={(v) => setVoiceForm({ ...voiceForm, type: v })}
            options={VOICE_TYPE_OPTIONS}
          />
          {voiceFormError && <p className="text-xs text-red-500">{voiceFormError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={closeVoiceModal}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleVoiceSave}>
              {editingVoiceKeyword ? 'Save Changes' : 'Add Keyword'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
