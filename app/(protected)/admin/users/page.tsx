'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

interface AdminUser {
  _id: string
  name: string
  email: string
  tier: 'free' | 'premium'
  premiumOverride: boolean
  isVerified: boolean
  notifications: { lastSeen: string | null }
  ai: {
    enabled: boolean
    queriesUsed: number
    queriesCapOverride: number | null
    resetDate: string
  }
  createdAt: string
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [confirmReset, setConfirmReset] = useState<string | null>(null)
  const limit = 20

  // Admin-only guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.isAdmin) router.replace('/dashboard')
  }, [session, status, router])

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

  useEffect(() => {
    if (session?.user?.isAdmin) fetchUsers()
  }, [fetchUsers, session])

  const updateUser = async (id: string, patch: Record<string, unknown>) => {
    const prev = users
    // Optimistic update for ai.enabled
    if ('ai.enabled' in patch) {
      setUsers(us => us.map(u => u._id === id ? { ...u, ai: { ...u.ai, enabled: patch['ai.enabled'] as boolean } } : u))
    }
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers(us => us.map(u => u._id === id ? { ...u, ...updated } : u))
      toast('User updated', 'success')
    } else {
      setUsers(prev)
      toast('Update failed', 'error')
    }
  }

  const resetQueries = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}/reset-queries`, { method: 'POST' })
    if (res.ok) {
      setUsers(us => us.map(u => u._id === id ? { ...u, ai: { ...u.ai, queriesUsed: 0 } } : u))
      toast('Queries reset', 'success')
    } else {
      toast('Reset failed', 'error')
    }
    setConfirmReset(null)
  }

  if (status === 'loading' || !session?.user?.isAdmin) return null

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
            Users
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {total} total users
          </p>
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
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['User', 'Last Login', 'Verified', 'Tier', 'AI', 'Queries', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold"
                    style={{ color: 'var(--color-text-muted)', fontFamily: "'Sora', sans-serif" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--color-border)', width: j === 0 ? '120px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.map((user) => (
                <tr
                  key={user._id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* User */}
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
                      {user.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                      {user.email}
                    </p>
                  </td>

                  {/* Last Login */}
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                      {relativeTime(user.notifications?.lastSeen ?? null)}
                    </span>
                  </td>

                  {/* Verified */}
                  <td className="px-4 py-3">
                    {user.isVerified
                      ? <CheckCircle className="h-4 w-4" style={{ color: 'var(--color-income)' }} />
                      : <XCircle className="h-4 w-4" style={{ color: 'var(--color-expense)' }} />
                    }
                  </td>

                  {/* Tier */}
                  <td className="px-4 py-3">
                    <select
                      value={user.tier}
                      onChange={(e) => updateUser(user._id, { tier: e.target.value })}
                      className="text-xs px-2 py-1 rounded-full font-semibold border-0 cursor-pointer focus:outline-none"
                      style={{
                        fontFamily: "'Sora', sans-serif",
                        backgroundColor: user.tier === 'premium' ? 'var(--color-pale)' : 'var(--color-elevated)',
                        color: user.tier === 'premium' ? 'var(--color-active)' : 'var(--color-text-secondary)',
                      }}
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>

                  {/* AI toggle */}
                  <td className="px-4 py-3">
                    <Toggle
                      checked={user.ai.enabled}
                      onChange={(v) => updateUser(user._id, { 'ai.enabled': v })}
                    />
                  </td>

                  {/* Queries */}
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                      {user.ai.queriesUsed} / {user.ai.queriesCapOverride ?? '15'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {confirmReset === user._id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => resetQueries(user._id)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmReset(null)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmReset(user._id)}
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-secondary)',
                          fontFamily: "'Sora', sans-serif",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        Reset Queries
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p style={{ color: 'var(--color-text-muted)' }}>Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Previous</Button>
            <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Next</Button>
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
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
      style={{ backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-border)' }}
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
