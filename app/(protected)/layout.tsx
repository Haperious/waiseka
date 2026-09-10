'use client'

import { useEffect, useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import BottomNav from '@/components/layout/BottomNav'
import QuickAddSheet from '@/components/quick-add/QuickAddSheet'
import CommandPalette from '@/components/quick-add/CommandPalette'
import OnboardingProvider from '@/components/onboarding/OnboardingProvider'
import { AccountsProvider } from '@/hooks/useAccounts'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <SessionProvider>
      <AccountsProvider>
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex flex-col flex-1 min-w-0" style={{ overflow: 'visible', minHeight: 0 }}>
            <Navbar onMenuClick={() => setSidebarOpen(true)} onSearchClick={() => setCommandPaletteOpen(true)} />
            <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 pb-20 lg:pb-6">
              {children}
            </main>
          </div>
          <BottomNav onMoreClick={() => setSidebarOpen(true)} onAddClick={() => setQuickAddOpen(true)} />
          <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
          <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
        </div>
        {/* Onboarding checklist - renders for new users only, self-dismisses */}
        <OnboardingProvider />
      </AccountsProvider>
    </SessionProvider>
  )
}
