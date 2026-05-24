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
  BarChart3,
  Settings,
  X,
  Bot,
  Shield,
  Tags,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/budgets', label: 'Budgets', icon: PieChart },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/ai/chat', label: 'AI Assistant', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme } = useTheme()
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
            className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'font-semibold' : 'hover:opacity-80'
                )}
                style={isActive
                  ? { backgroundColor: 'var(--color-elevated)', color: 'var(--color-accent)' }
                  : { color: 'var(--color-text-secondary)' }
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {isAdmin && (
          <div className="px-3 pb-4 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
            <Link
              href="/admin/users"
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith('/admin') ? 'font-semibold' : 'hover:opacity-80'
              )}
              style={pathname.startsWith('/admin')
                ? { backgroundColor: 'var(--color-elevated)', color: 'var(--color-accent)' }
                : { color: 'var(--color-text-secondary)' }
              }
            >
              <Shield className="h-5 w-5 shrink-0" />
              Admin
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
