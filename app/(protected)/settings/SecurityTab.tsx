'use client'

import { useState, useCallback } from 'react'
import { signOut } from 'next-auth/react'
import { ShieldCheck, ShieldOff, Copy, Eye, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import PasswordInput from '@/components/ui/PasswordInput'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { useResource } from '@/hooks/useFetch'
import { cn } from '@/lib/utils'
import type { SettingsTabProps } from './shared'
import styles from './settings.module.css'

const tokenInputStyle: React.CSSProperties = {
  width: '100%', borderRadius: 10, padding: '10px 16px', textAlign: 'center',
  fontFamily: 'monospace', letterSpacing: '0.2em', fontSize: '1.2rem', outline: 'none',
  backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
}

export default function SecurityTab({ hidden }: SettingsTabProps) {
  return (
    <div className={styles.panelBody} hidden={hidden}>
      <PasswordSection />
      <MfaSection />
    </div>
  )
}

// ── Password ─────────────────────────────────────────────────────────────────
function PasswordSection() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordLoading, setPasswordLoading] = useState(false)

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

  return (
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
  )
}

// ── Two-factor authentication ────────────────────────────────────────────────
function MfaSection() {
  const { toast } = useToast()

  const fetchMfaStatus = useCallback(async () => {
    const res = await fetch('/api/auth/mfa/status')
    if (!res.ok) throw new Error(`mfa status ${res.status}`)
    const d: { enabled?: boolean } = await res.json()
    return d.enabled ?? false
  }, [])
  const { data: mfaEnabled = false, loading: mfaLoading, mutate: setMfaStatus } = useResource(fetchMfaStatus)

  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'backup-codes' | 'disable'>('idle')
  const [mfaQr, setMfaQr] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaWorking, setMfaWorking] = useState(false)
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([])
  const [showSecret, setShowSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

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
      setMfaStatus(() => true)
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
      setMfaStatus(() => false)
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

  return (
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
              style={tokenInputStyle}
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
            style={tokenInputStyle}
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
  )
}
