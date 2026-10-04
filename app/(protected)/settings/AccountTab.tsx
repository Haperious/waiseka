'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowUpRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { useResource } from '@/hooks/useFetch'
import { isPremium } from '@/lib/tier'
import { cn } from '@/lib/utils'
import type { SettingsTabProps } from './shared'
import styles from './settings.module.css'

interface Me {
  name?: string
  avatar?: string
  ai?: { queriesUsed?: number; queriesCapOverride?: number | null }
}

export default function AccountTab({ hidden }: SettingsTabProps) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { data: session } = useSession()
  const router = useRouter()
  const isVerified = session?.user?.isVerified ?? true
  const userIsPremium = session?.user ? isPremium(session.user as { tier: string; premiumOverride: boolean }) : false

  const fetchMe = useCallback(async () => {
    const res = await fetch('/api/users/me')
    if (!res.ok) throw new Error(`users/me ${res.status}`)
    return res.json() as Promise<Me>
  }, [])
  const { data: me } = useResource(fetchMe)
  const aiUsage = me?.ai ? { queriesUsed: me.ai.queriesUsed ?? 0, cap: me.ai.queriesCapOverride ?? null } : null

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

  return (
    <div className={styles.panelBody} hidden={hidden}>
      <div className={styles.fieldGroup}>
        <p className={styles.groupLabel}>{t('settings.profile')}</p>
        {/* Remounts once the profile loads, so the form starts from the saved values */}
        <ProfileForm key={me ? 'loaded' : 'loading'} initialName={me?.name ?? ''} initialAvatar={me?.avatar ?? ''} />
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
    </div>
  )
}

function ProfileForm({ initialName, initialAvatar }: { initialName: string; initialAvatar: string }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [profile, setProfile] = useState({ name: initialName, avatar: initialAvatar })
  const [loading, setLoading] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
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
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
        <Button type="submit" loading={loading}>
          {t('settings.saveProfile')}
        </Button>
      </div>
    </form>
  )
}
