'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTheme } from '@/context/ThemeContext'
import { useEffect, useState } from 'react'
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
  BookOpen,
  MessageSquare,
  Wallet,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/LanguageContext'
import type { TranslationKey } from '@/lib/translations'

type NavItem = { href: string; labelKey: TranslationKey; icon: React.ElementType }
type NavSection = { labelKey: TranslationKey; items: NavItem[] }

const navSections: NavSection[] = [
  {
    labelKey: 'nav.section.moneyNow',
    items: [
      { href: '/dashboard',    labelKey: 'nav.dashboard',    icon: LayoutDashboard },
      { href: '/transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight  },
      { href: '/accounts',     labelKey: 'nav.accounts',     icon: Wallet          },
    ],
  },
  {
    labelKey: 'nav.section.planAhead',
    items: [
      { href: '/budgets',      labelKey: 'nav.budgets',      icon: PieChart        },
      { href: '/goals',        labelKey: 'nav.goals',        icon: Target          },
      { href: '/categories',   labelKey: 'nav.categories',   icon: Tags            },
      { href: '/reports',      labelKey: 'nav.reports',      icon: CalendarDays    },
    ],
  },
  {
    labelKey: 'nav.section.learn',
    items: [
      { href: '/ai/chat',      labelKey: 'nav.aiAssistant',  icon: Bot             },
      { href: '/tips',         labelKey: 'nav.tips',         icon: BookOpen        },
    ],
  },
  {
    labelKey: 'nav.section.settings',
    items: [
      { href: '/settings',     labelKey: 'nav.settings',     icon: Settings        },
    ],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

// The mobile "More" drawer only lists items not already on the bottom nav
// (Home / Transactions / Budgets have their own tap targets there).
const MOBILE_MORE_HREFS = new Set(['/accounts', '/goals', '/reports', '/categories', '/ai/chat', '/tips', '/settings'])

const SIDEBAR_COLLAPSED_KEY = 'waiseka-sidebar-collapsed'

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme } = useTheme()
  const { t } = useLanguage()
  const isAdmin = session?.user?.isAdmin === true
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored === '1') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }

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
          'fixed inset-y-0 left-0 z-30 w-64 flex flex-col border-r transition-[transform,width] duration-300',
          collapsed ? 'lg:w-16' : 'lg:w-64',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div
          className={cn(
            'flex items-center justify-between h-16 lg:h-auto lg:py-3 px-6 border-b lg:border-b-0',
            collapsed ? 'lg:justify-center lg:px-0' : 'lg:justify-between lg:px-4'
          )}
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
              alt="Waiseka"
              width={32}
              height={32}
              className="rounded-lg lg:w-[30px] lg:h-[30px]"
              style={{ objectFit: 'contain' }}
            />
            <span
              className={cn('text-lg font-bold', collapsed ? 'lg:hidden' : '')}
              style={{ color: 'var(--color-text-primary)' }}
            >
              Waiseka
            </span>
          </Link>
          <button
            onClick={toggleCollapsed}
            className={cn('hidden hover:opacity-70 transition-opacity', collapsed ? 'lg:hidden' : 'lg:block')}
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="lg:hidden hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {collapsed && (
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex items-center justify-center py-2 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="h-5 w-5" />
          </button>
        )}

        {/* Mobile "More" drawer: grouped by the same sections as the desktop rail ── */}
        <nav className="lg:hidden flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {navSections.map((section) => {
            const items = section.items.filter(({ href }) => MOBILE_MORE_HREFS.has(href))
            if (items.length === 0) return null
            return (
              <div key={section.labelKey} className="space-y-2">
                <p
                  className="px-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {t(section.labelKey)}
                </p>
                {items.map(({ href, labelKey, icon: Icon }) => {
                  const isActive = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 transition-colors"
                      style={{
                        minHeight: 52,
                        borderRadius: 12,
                        backgroundColor: 'var(--color-elevated)',
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      }}
                    >
                      <span style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        backgroundColor: isActive ? 'var(--color-sage)' : 'var(--color-card)',
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      }}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm font-medium">{t(labelKey)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Desktop nav: icon rail when collapsed, icon+label list when expanded ── */}
        <nav
          className={cn(
            'hidden lg:flex flex-1 flex-col overflow-y-auto py-3 gap-3',
            collapsed ? 'items-center no-scrollbar' : 'items-stretch px-3'
          )}
        >
          {navSections.map((section, sectionIndex) => (
            <div key={section.labelKey} className={cn('flex flex-col gap-1.5', collapsed ? 'items-center w-full' : '')}>
              {!collapsed && (
                <p
                  className="px-3 pb-0.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {t(section.labelKey)}
                </p>
              )}
              {collapsed && sectionIndex > 0 && (
                <div
                  className="mx-auto mb-1.5"
                  style={{ width: 28, height: 1, backgroundColor: 'var(--color-border)' }}
                />
              )}
              {section.items.map(({ href, labelKey, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <div key={href} className={cn('relative', collapsed ? 'group' : '')}>
                    <Link
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center transition-colors',
                        collapsed ? 'justify-center' : 'gap-3 px-3'
                      )}
                      style={{
                        height: 40,
                        borderRadius: 11,
                        backgroundColor: isActive ? 'var(--color-sage)' : 'transparent',
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        ...(collapsed ? { width: 40 } : {}),
                      }}
                      aria-label={t(labelKey)}
                    >
                      <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={2} />
                      {!collapsed && <span className="text-sm font-medium truncate">{t(labelKey)}</span>}
                    </Link>
                    {collapsed && (
                      <span
                        className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                        style={{
                          backgroundColor: 'var(--color-elevated)',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {t(labelKey)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {isAdmin && (
          <div
            className={cn(
              'px-3 pb-4 border-t pt-4 space-y-2 lg:flex lg:flex-col lg:gap-1.5 lg:space-y-0 lg:pt-3',
              collapsed ? 'lg:items-center lg:px-0' : 'lg:items-stretch'
            )}
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p
              className={cn(
                'px-3 pb-1 text-xs font-semibold uppercase tracking-wider',
                collapsed ? 'lg:hidden' : ''
              )}
              style={{ color: 'var(--color-text-muted)', fontFamily: "'Sora', sans-serif" }}
            >
              <Shield className="inline h-3 w-3 mr-1 mb-0.5" />
              Admin
            </p>
            {[
              { href: '/admin/users',      label: 'Users',      icon: Users          },
              { href: '/admin/surveys',    label: 'Surveys',    icon: MessageSquare  },
              { href: '/admin/email-logs', label: 'Email Logs', icon: Mail           },
              { href: '/admin/flags',      label: 'Flags',      icon: Flag           },
            ].map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    collapsed ? 'lg:group lg:relative lg:justify-center lg:gap-0 lg:py-0 lg:rounded-[11px]' : 'lg:py-0 lg:h-10 lg:rounded-[11px]',
                    isActive ? 'font-semibold' : cn('hover:bg-[var(--color-elevated)]', collapsed ? 'lg:hover:bg-transparent' : '')
                  )}
                  style={{
                    ...(isActive
                      ? {
                          backgroundColor: 'var(--color-sage)',
                          borderLeft: '2px solid var(--color-accent)',
                          color: 'var(--color-accent)',
                          paddingLeft: 'calc(0.75rem - 2px)',
                          paddingRight: '0.75rem',
                        }
                      : { color: 'var(--color-text-secondary)', paddingLeft: '0.75rem', paddingRight: '0.75rem' }),
                  }}
                >
                  <span className="flex items-center justify-center shrink-0 w-6 h-6 lg:w-10 lg:h-10">
                    <Icon className="h-4 w-4 lg:h-[19px] lg:w-[19px] shrink-0" />
                  </span>
                  <span className={collapsed ? 'lg:hidden' : 'truncate'}>{label}</span>
                  {collapsed && (
                    <span
                      className="hidden lg:block pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                      style={{
                        backgroundColor: 'var(--color-elevated)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {label}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </aside>
    </>
  )
}
