'use client'

import { useState, useEffect } from 'react'
import { Flag, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

interface Flags {
  aiEnabled: boolean
  aiQueryCap: number
  notificationsEnabled: boolean
  maintenanceMode: boolean
  updatedAt?: string
  updatedBy?: string
}

export default function AdminFlagsPage() {
  const { toast } = useToast()
  const [flags, setFlags] = useState<Flags | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/flags')
      .then((r) => r.json())
      .then((d) => setFlags(d))
      .catch(() => toast('Failed to load settings', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const save = async () => {
    if (!flags) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiEnabled: flags.aiEnabled,
          aiQueryCap: flags.aiQueryCap,
          notificationsEnabled: flags.notificationsEnabled,
          maintenanceMode: flags.maintenanceMode,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setFlags(data)
        toast('Settings saved', 'success')
      } else {
        toast(data.error ?? 'Failed to save', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!flags) return null

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <Flag className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feature Flags</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Global application settings</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 dark:text-white">AI Settings</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <FlagToggle
            label="Global AI enabled"
            description="Master kill switch for all AI features"
            checked={flags.aiEnabled}
            onChange={(v) => setFlags({ ...flags, aiEnabled: v })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Monthly query cap (default per user)
            </label>
            <input
              type="number"
              min={0}
              value={flags.aiQueryCap}
              onChange={(e) => setFlags({ ...flags, aiQueryCap: parseInt(e.target.value) || 0 })}
              className="w-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 dark:text-white">System Settings</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <FlagToggle
            label="Notifications enabled"
            description="Allow the system to send email and push notifications"
            checked={flags.notificationsEnabled}
            onChange={(v) => setFlags({ ...flags, notificationsEnabled: v })}
          />
          <FlagToggle
            label="Maintenance mode"
            description="When enabled, restrict access to the application"
            checked={flags.maintenanceMode}
            onChange={(v) => setFlags({ ...flags, maintenanceMode: v })}
            danger
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button onClick={save} loading={saving}>Save Settings</Button>
        {flags.updatedBy && flags.updatedAt && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last updated by {flags.updatedBy} at {new Date(flags.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}

function FlagToggle({
  label,
  description,
  checked,
  onChange,
  danger,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className={cn('text-sm font-medium', danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white')}>
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
          checked
            ? danger ? 'bg-red-600 focus:ring-red-500' : 'bg-blue-600 focus:ring-blue-500'
            : 'bg-gray-200 dark:bg-gray-700 focus:ring-blue-500'
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  )
}
