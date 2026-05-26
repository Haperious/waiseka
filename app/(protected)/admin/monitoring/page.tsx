'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Crown, Bot, Mail, Bell, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface Stats {
  totalUsers: number
  freeUsers: number
  premiumUsers: number
  totalAiQueriesThisMonth: number
  emailNotificationsEnabled: number
  pushNotificationsEnabled: number
}

export default function AdminMonitoringPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/monitoring')
      const data = await res.json()
      setStats(data)
      setLastUpdated(new Date())
    } catch {
      // silent - auto-refresh will retry
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60_000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const cards = stats
    ? [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'blue' },
        { label: 'Free Users', value: stats.freeUsers, icon: Users, color: 'gray' },
        { label: 'Premium Users', value: stats.premiumUsers, icon: Crown, color: 'yellow' },
        { label: 'AI Queries This Month', value: stats.totalAiQueriesThisMonth, icon: Bot, color: 'purple' },
        { label: 'Email Notifications On', value: stats.emailNotificationsEnabled, icon: Mail, color: 'green' },
        { label: 'Push Notifications On', value: stats.pushNotificationsEnabled, icon: Bell, color: 'orange' },
      ]
    : []

  const colorClasses: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-800', icon: 'text-gray-500 dark:text-gray-400' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: 'text-yellow-600 dark:text-yellow-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-600 dark:text-purple-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', icon: 'text-green-600 dark:text-green-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', icon: 'text-orange-600 dark:text-orange-400' },
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monitoring</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
            {' · '}Auto-refreshes every 60s
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading && !stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ label, value, icon: Icon, color }) => {
            const { bg, icon } = colorClasses[color]
            return (
              <Card key={label}>
                <CardContent className="flex items-center gap-4 py-5">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', bg)}>
                    <Icon className={cn('h-6 w-6', icon)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
