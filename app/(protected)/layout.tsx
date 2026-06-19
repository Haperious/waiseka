'use client'

import { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import BottomNav from '@/components/layout/BottomNav'
import OnboardingProvider from '@/components/onboarding/OnboardingProvider'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 pb-20 lg:pb-6">
            {children}
          </main>
        </div>
        <BottomNav onMoreClick={() => setSidebarOpen(true)} />
      </div>
      {/* Onboarding checklist — renders for new users only, self-dismisses */}
      <OnboardingProvider />
    </SessionProvider>
  )
}
