'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  Bot,
  MoreHorizontal,
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import type { TranslationKey } from '@/lib/translations'

const bottomNavItems: { href: string; labelKey: TranslationKey; icon: React.ElementType }[] = [
  { href: '/dashboard',    labelKey: 'nav.home',         icon: LayoutDashboard },
  { href: '/transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight  },
  { href: '/budgets',      labelKey: 'nav.budgets',      icon: PieChart        },
  { href: '/goals',        labelKey: 'nav.goals',        icon: Target          },
  { href: '/ai/chat',      labelKey: 'nav.ai',           icon: Bot             },
]

interface BottomNavProps {
  onMoreClick: () => void
}

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const isMoreActive = ['/settings', '/admin', '/categories'].some((p) =>
    pathname.startsWith(p)
  )

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {bottomNavItems.map(({ href, labelKey, icon: Icon }) => {
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
      })}

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
