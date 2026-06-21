'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTheme } from '@/context/ThemeContext'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  Settings,
  X,
  Bot,
  Shield,
  Tags,
  Users,
  Mail,
  Flag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/LanguageContext'
import type { TranslationKey } from '@/lib/translations'

const navItems: { href: string; labelKey: TranslationKey; icon: React.ElementType }[] = [
  { href: '/dashboard',    labelKey: 'nav.dashboard',    icon: LayoutDashboard },
  { href: '/transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight  },
  { href: '/budgets',      labelKey: 'nav.budgets',      icon: PieChart        },
  { href: '/goals',        labelKey: 'nav.goals',        icon: Target          },
  { href: '/categories',   labelKey: 'nav.categories',   icon: Tags            },
  { href: '/ai/chat',      labelKey: 'nav.aiAssistant',  icon: Bot             },
  { href: '/settings',     labelKey: 'nav.settings',     icon: Settings        },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme } = useTheme()
  const { t } = useLanguage()
  const isAdmin = session?.user?.isAdmin === true

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 flex flex-col border-r transition-transform duration-300',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
              alt="Waiseka"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Waiseka</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ href, labelKey, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive ? 'font-semibold' : 'hover:bg-[var(--color-elevated)]'
                )}
                style={isActive
                  ? {
                      backgroundColor: 'var(--color-sage)',
                      borderLeft: '2px solid var(--color-accent)',
                      color: 'var(--color-accent)',
                      paddingLeft: 'calc(0.75rem - 2px)',
                      paddingRight: '0.75rem',
                    }
                  : { color: 'var(--color-text-secondary)', paddingLeft: '0.75rem', paddingRight: '0.75rem' }
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {t(labelKey)}
              </Link>
            )
          })}
        </nav>

        {isAdmin && (
          <div className="px-3 pb-4 border-t pt-3 space-y-0.5" style={{ borderColor: 'var(--color-border)' }}>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontFamily: "'Sora', sans-serif" }}>
              <Shield className="inline h-3 w-3 mr-1 mb-0.5" />
              Admin
            </p>
            {[
              { href: '/admin/users',      label: 'Users',      icon: Users },
              { href: '/admin/email-logs', label: 'Email Logs', icon: Mail  },
              { href: '/admin/flags',      label: 'Flags',      icon: Flag  },
            ].map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive ? 'font-semibold' : 'hover:bg-[var(--color-elevated)]'
                  )}
                  style={isActive
                    ? {
                        backgroundColor: 'var(--color-sage)',
                        borderLeft: '2px solid var(--color-accent)',
                        color: 'var(--color-accent)',
                        paddingLeft: 'calc(0.75rem - 2px)',
                        paddingRight: '0.75rem',
                      }
                    : { color: 'var(--color-text-secondary)', paddingLeft: '0.75rem', paddingRight: '0.75rem' }
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        )}
      </aside>
    </>
  )
}
