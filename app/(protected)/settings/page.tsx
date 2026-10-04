'use client'

import { useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Shield, Wallet, Bell, Sun, Mic } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { cn } from '@/lib/utils'
import AccountTab from './AccountTab'
import SecurityTab from './SecurityTab'
import MoneyTab from './MoneyTab'
import NotificationsTab from './NotificationsTab'
import DisplayTab from './DisplayTab'
import VoiceTab from './VoiceTab'
import styles from './settings.module.css'

type TabId = 'account' | 'security' | 'money' | 'notifs' | 'display' | 'voice'

const TAB_IDS: TabId[] = ['account', 'security', 'money', 'notifs', 'display', 'voice']

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()

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

        {/* Every tab stays mounted (hidden when inactive) so unsaved edits survive tab switches */}
        <AccountTab hidden={activeTab !== 'account'} />
        <SecurityTab hidden={activeTab !== 'security'} />
        <MoneyTab hidden={activeTab !== 'money'} />
        <NotificationsTab hidden={activeTab !== 'notifs'} />
        <DisplayTab hidden={activeTab !== 'display'} />
        <VoiceTab hidden={activeTab !== 'voice'} />
      </div>
    </div>
  )
}
