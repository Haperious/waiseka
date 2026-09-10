'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  MoreHorizontal,
  Plus,
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import type { TranslationKey } from '@/lib/translations'

const bottomNavItems: { href: string; labelKey: TranslationKey; icon: React.ElementType }[] = [
  { href: '/dashboard',    labelKey: 'nav.home',         icon: LayoutDashboard },
  { href: '/transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight  },
]

const bottomNavItemsAfterFab: { href: string; labelKey: TranslationKey; icon: React.ElementType }[] = [
  { href: '/budgets', labelKey: 'nav.budgets', icon: PieChart },
]

interface BottomNavProps {
  onMoreClick: () => void
  onAddClick: () => void
}

export default function BottomNav({ onMoreClick, onAddClick }: BottomNavProps) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const isMoreActive = ['/settings', '/admin', '/categories', '/goals', '/ai', '/accounts', '/tips', '/reports'].some((p) =>
    pathname.startsWith(p)
  )

  const renderLink = ({ href, labelKey, icon: Icon }: (typeof bottomNavItems)[number]) => {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        key={href}
        href={href}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-opacity"
        style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="text-[10px] font-medium leading-none">{t(labelKey)}</span>
      </Link>
    )
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {bottomNavItems.map(renderLink)}

      {/* Center raised + FAB - opens quick-add sheet */}
      <div className="flex-1 flex items-center justify-center relative">
        <button
          onClick={onAddClick}
          aria-label={t('nav.quickAdd')}
          className="absolute flex items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
          style={{
            width: 56,
            height: 56,
            marginTop: -20,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            border: '3px solid var(--color-surface)',
            boxShadow: '0 4px 20px rgba(22,163,74,.35)',
            color: '#fff',
          }}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {bottomNavItemsAfterFab.map(renderLink)}

      {/* More - opens sidebar drawer */}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-opacity hover:opacity-70"
        style={{ color: isMoreActive ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
        aria-label="More"
      >
        <MoreHorizontal className="h-5 w-5 shrink-0" />
        <span className="text-[10px] font-medium leading-none">{t('nav.more')}</span>
      </button>
    </nav>
  )
}
