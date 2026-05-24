'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Sun, Moon } from 'lucide-react'
import UserMenu from './UserMenu'
import { useTheme } from '@/context/ThemeContext'

interface NavbarProps {
  onMenuClick: () => void
  title?: string
}

export default function Navbar({ onMenuClick, title }: NavbarProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-3">
        {/* Logo — visible on mobile only (sidebar handles desktop) */}
        <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
          <Image
            src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
            alt="Waiseka"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Waiseka</span>
        </Link>
        {title && <h1 className="text-lg font-semibold hidden sm:block" style={{ color: 'var(--color-text-primary)' }}>{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
