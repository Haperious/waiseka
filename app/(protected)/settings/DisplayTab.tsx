'use client'

import { useState } from 'react'
import { Sun, Moon, PieChart, Tags } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, selectionCardStyle, type SettingsTabProps } from './shared'
import styles from './settings.module.css'

export default function DisplayTab({ hidden }: SettingsTabProps) {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { toast } = useToast()
  const { preferences, update: updatePreferences } = usePreferences()
  const reportsDefaultView = preferences?.reportsDefaultView ?? 'chart'
  const [reportsViewSaving, setReportsViewSaving] = useState(false)

  // update() is optimistic and rolls itself back on failure
  const handleReportsDefaultViewChange = async (next: 'chart' | 'table') => {
    if (next === reportsDefaultView) return
    setReportsViewSaving(true)
    try {
      await updatePreferences({ reportsDefaultView: next })
    } catch (err) {
      toast(errorMessage(err, 'Failed to update default report view'), 'error')
    } finally {
      setReportsViewSaving(false)
    }
  }

  return (
    <div className={styles.panelBody} hidden={hidden}>
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
                disabled={reportsViewSaving}
                style={{ ...selectionCardStyle(isActive), opacity: reportsViewSaving ? 0.7 : 1, cursor: reportsViewSaving ? 'default' : 'pointer' }}
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
    </div>
  )
}
