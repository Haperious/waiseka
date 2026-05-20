'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { LogOut, Settings, ChevronDown } from 'lucide-react'
import { useCurrency } from '@/context/CurrencyContext'
import { getAllCurrencies, CurrencyCode } from '@/lib/currency'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

export default function UserMenu() {
  const { data: session } = useSession()
  const { currency, setCurrency } = useCurrency()
  const { toast } = useToast()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const currencyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) setCurrencyMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => {
    toast('You have been logged out', 'success')
    await signOut({ callbackUrl: '/login' })
  }

  const handleCurrencySwitch = async (code: CurrencyCode) => {
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: code }),
      })
      const data = await res.json()
      if (res.ok) {
        setCurrency(code)
        const info = getAllCurrencies().find((c) => c.code === code)
        toast(`Currency updated to ${info?.label} ${info?.symbol}`, 'success')
      } else {
        toast(data.error ?? 'Failed to update currency', 'error')
      }
    } catch {
      toast('Failed to update currency', 'error')
    }
    setCurrencyMenuOpen(false)
  }

  const name = session?.user?.name ?? 'User'
  const email = session?.user?.email ?? ''
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const currencies = getAllCurrencies()
  const current = currencies.find((c) => c.code === currency)

  return (
    <div className="flex items-center gap-2">
      {/* Currency badge */}
      <div ref={currencyRef} className="relative">
        <button
          onClick={() => setCurrencyMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Switch currency"
        >
          <span>{current?.flag}</span>
          <span>{currency}</span>
          <span className="text-xs text-gray-400">{current?.symbol}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {currencyMenuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
            {currencies.map((c) => (
              <button
                key={c.code}
                onClick={() => handleCurrencySwitch(c.code as CurrencyCode)}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  c.code === currency ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                )}
              >
                <span>{c.flag}</span>
                <span>{c.label}</span>
                <span className="ml-auto text-xs text-gray-400">{c.symbol}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User menu */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="User menu"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt={name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-none">{name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[120px]">{email}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
            <Link
              href="/settings"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <hr className="my-1 border-gray-100 dark:border-gray-700" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
