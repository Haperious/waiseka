'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Sun, Moon } from 'lucide-react'
import UserMenu from './UserMenu'
import NotificationBell from './NotificationBell'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'

interface NavbarProps {
  onMenuClick: () => void
  title?: string
}

export default function Navbar({ onMenuClick, title }: NavbarProps) {
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage } = useLanguage()

  return (
    <header
      className="h-16 flex items-center justify-between px-4 md:px-6 border-b backdrop-blur-md sticky top-0 z-10"
      style={{ backgroundColor: 'var(--color-surface-blur)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-3">
        {/* Logo - mobile only, sidebar handles desktop */}
        <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
          <Image
            src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
            alt="Waiseka"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>WaiseKa</span>
        </Link>
        {title && (
          <h1 className="text-lg font-semibold hidden sm:block" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'tl' : 'en')}
          className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.96]"
          style={{
            backgroundColor: 'var(--color-elevated)',
            border: '1px solid var(--color-border)',
            letterSpacing: '0.05em',
          }}
          aria-label={language === 'en' ? 'Switch to Filipino (Tagalog)' : 'Switch to English'}
          title={language === 'en' ? 'Switch to Filipino' : 'Switch to English'}
        >
          <span style={{ color: language === 'en' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>EN</span>
          <span style={{ color: 'var(--color-text-muted)', margin: '0 2px' }}>·</span>
          <span style={{ color: language === 'tl' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>TL</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-all hover:opacity-70 active:scale-[0.95]"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
