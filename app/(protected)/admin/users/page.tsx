'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

interface AdminUser {
  _id: string
  name: string
  email: string
  tier: 'free' | 'premium'
  premiumOverride: boolean
  ai: {
    enabled: boolean
    queriesUsed: number
    queriesCapOverride: number | null
    resetDate: string
  }
  createdAt: string
}

export default function AdminUsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [confirmReset, setConfirmReset] = useState<string | null>(null)
  const limit = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=${limit}`)
      const data = await res.json()
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } catch {
      toast('Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, toast])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const updateUser = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, ...updated } : u)))
      toast('User updated', 'success')
    } else {
      toast('Update failed', 'error')
    }
  }

  const resetQueries = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}/reset-queries`, { method: 'POST' })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, ai: { ...u.ai, queriesUsed: 0 } } : u)))
      toast('Queries reset', 'success')
    } else {
      toast('Reset failed', 'error')
    }
    setConfirmReset(null)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} total users</p>
        </div>
        <Button variant="outline" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-left font-medium">Premium Override</th>
                <th className="px-4 py-3 text-left font-medium">AI Enabled</th>
                <th className="px-4 py-3 text-left font-medium">Queries</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr key={user._id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.tier}
                      onChange={(e) => updateUser(user._id, { tier: e.target.value })}
                      className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500',
                        user.tier === 'premium'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      checked={user.premiumOverride}
                      onChange={(v) => updateUser(user._id, { premiumOverride: v })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      checked={user.ai.enabled}
                      onChange={(v) => updateUser(user._id, { 'ai.enabled': v })}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {user.ai.queriesUsed} / {user.ai.queriesCapOverride ?? '15 (default)'}
                  </td>
                  <td className="px-4 py-3">
                    {confirmReset === user._id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => resetQueries(user._id)}
                          className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmReset(null)}
                          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmReset(user._id)}
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Reset Queries
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
        checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
      )}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          'inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  )
}
