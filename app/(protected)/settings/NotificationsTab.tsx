'use client'

import { useState, useCallback } from 'react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { useResource } from '@/hooks/useFetch'
import { Toggle, type SettingsTabProps } from './shared'
import styles from './settings.module.css'

type Frequency = 'daily' | 'weekly' | 'monthly'

interface NotificationSettings {
  emailEnabled: boolean
  pushEnabled: boolean
  frequency: Frequency
  emailCount: number
}

const DEFAULT_SETTINGS: NotificationSettings = { emailEnabled: false, pushEnabled: false, frequency: 'weekly', emailCount: 1 }

const maxCountFor = (frequency: Frequency) => (frequency === 'daily' ? 5 : frequency === 'weekly' ? 7 : 30)

const stepButtonStyle = (disabled: boolean): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-card)', color: 'var(--color-text-primary)',
  fontSize: '1.1rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
})

export default function NotificationsTab({ hidden }: SettingsTabProps) {
  const fetchSettings = useCallback(async (): Promise<NotificationSettings> => {
    const res = await fetch('/api/notifications')
    if (!res.ok) throw new Error(`notifications ${res.status}`)
    const d = await res.json()
    return {
      emailEnabled: d?.email?.enabled ?? false,
      pushEnabled: d?.push?.enabled ?? false,
      frequency: d?.email?.frequency ?? d?.push?.frequency ?? 'weekly',
      emailCount: d?.email?.count || 1,
    }
  }, [])
  const { data } = useResource(fetchSettings)

  // Remounts once the saved settings load, so the form starts from them
  return <NotificationsForm key={data ? 'loaded' : 'loading'} initial={data ?? DEFAULT_SETTINGS} hidden={hidden} />
}

function NotificationsForm({ initial, hidden }: { initial: NotificationSettings; hidden: boolean }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [emailEnabled, setEmailEnabled] = useState(initial.emailEnabled)
  const [pushEnabled, setPushEnabled] = useState(initial.pushEnabled)
  const [frequency, setFrequency] = useState(initial.frequency)
  const [emailCount, setEmailCount] = useState(initial.emailCount)
  const [saving, setSaving] = useState(false)

  const maxEmailCount = maxCountFor(frequency)

  const handleFrequencyChange = (newFreq: Frequency) => {
    setFrequency(newFreq)
    setEmailCount((v) => Math.min(v, maxCountFor(newFreq)))
  }

  const saveNotifications = async (overrides?: { push?: { enabled: boolean; fcmToken: string | null } }) => {
    setSaving(true)
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
      setSaving(false)
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

  return (
    <>
      <div className={styles.panelBody} hidden={hidden}>
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
                    style={stepButtonStyle(emailCount <= 1)}
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
                    style={stepButtonStyle(emailCount >= maxEmailCount)}
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
      </div>

      {!hidden && (
        <div className={styles.footer}>
          <p className={styles.footerHelper}>Applies to both email and push reminders.</p>
          <Button onClick={() => saveNotifications()} loading={saving}>
            {t('settings.saveNotifs')}
          </Button>
        </div>
      )}
    </>
  )
}
