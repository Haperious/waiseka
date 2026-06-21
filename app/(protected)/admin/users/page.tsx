'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle, XCircle, Users, Crown, Bot, Mail, Bell } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number
  freeUsers: number
  premiumUsers: number
  totalAiQueriesThisMonth: number
  emailNotificationsEnabled: number
  pushNotificationsEnabled: number
}

interface AdminUser {
  _id: string
  name: string
  email: string
  tier: 'free' | 'premium'
  premiumOverride: boolean
  isVerified: boolean
  lastLogin: string | null
  ai: {
    enabled: boolean
    queriesUsed: number
    queriesCapOverride: number | null
    resetDate: string
  }
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Stat Cards ───────────────────────────────────────────────────────────────

const STAT_CONFIG = [
  { key: 'totalUsers',                label: 'Total Users',         icon: Users,  color: 'var(--color-accent)',   bg: 'var(--color-pale)'     },
  { key: 'freeUsers',                 label: 'Free',                icon: Users,  color: 'var(--color-text-muted)', bg: 'var(--color-elevated)' },
  { key: 'premiumUsers',              label: 'Premium',             icon: Crown,  color: '#d97706',               bg: '#fef3c7'               },
  { key: 'totalAiQueriesThisMonth',   label: 'AI Queries (month)',  icon: Bot,    color: '#7c3aed',               bg: '#ede9fe'               },
  { key: 'emailNotificationsEnabled', label: 'Email Notifs On',     icon: Mail,   color: '#059669',               bg: '#d1fae5'               },
  { key: 'pushNotificationsEnabled',  label: 'Push Notifs On',      icon: Bell,   color: '#ea580c',               bg: '#ffedd5'               },
] as const

function StatCards({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {STAT_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
        <Card key={key}>
          <CardContent className="p-3 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            {loading || !stats ? (
              <div className="h-6 w-12 rounded animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
            ) : (
              <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
                {stats[key].toLocaleString()}
              </p>
            )}
            <p className="text-xs leading-tight" style={{ color: 'var(--color-text-muted)', fontFamily: "'Sora', sans-serif" }}>
              {label}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

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

// ─── Mobile User Card ─────────────────────────────────────────────────────────

function UserCard({
  user,
  onUpdate,
  onResetConfirm,
  onReminderConfirm,
  confirmReset,
  confirmReminder,
  sendingReminder,
  onResetCancel,
  onReminderCancel,
  onReset,
  onReminder,
}: {
  user: AdminUser
  onUpdate: (id: string, patch: Record<string, unknown>) => void
  onResetConfirm: (id: string) => void
  onReminderConfirm: (id: string) => void
  confirmReset: string | null
  confirmReminder: string | null
  sendingReminder: string | null
  onResetCancel: () => void
  onReminderCancel: () => void
  onReset: (id: string) => void
  onReminder: (id: string) => void
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Name + email + badges */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
              {user.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
              {user.email}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {user.isVerified
              ? <CheckCircle className="h-4 w-4" style={{ color: 'var(--color-income)' }} />
              : <XCircle className="h-4 w-4" style={{ color: 'var(--color-expense)' }} />
            }
            <select
              value={user.tier}
              onChange={(e) => onUpdate(user._id, { tier: e.target.value })}
              className="text-xs px-2 py-0.5 rounded-full font-semibold border-0 cursor-pointer focus:outline-none"
              style={{
                fontFamily: "'Sora', sans-serif",
                backgroundColor: user.tier === 'premium' ? 'var(--color-pale)' : 'var(--color-elevated)',
                color: user.tier === 'premium' ? 'var(--color-active)' : 'var(--color-text-secondary)',
              }}
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span style={{ fontFamily: "'DM Mono', monospace" }}>Last: {relativeTime(user.lastLogin ?? null)}</span>
          <span style={{ fontFamily: "'DM Mono', monospace" }}>Queries: {user.ai.queriesUsed}/{user.ai.queriesCapOverride ?? 15}</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <span style={{ fontFamily: "'Sora', sans-serif" }}>AI</span>
            <Toggle checked={user.ai.enabled} onChange={(v) => onUpdate(user._id, { 'ai.enabled': v })} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {confirmReset === user._id ? (
            <>
              <button onClick={() => onReset(user._id)} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}>Confirm</button>
              <button onClick={onResetCancel} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>Cancel</button>
            </>
          ) : (
            <button
              onClick={() => onResetConfirm(user._id)}
              className="text-xs px-2 py-1 rounded"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontFamily: "'Sora', sans-serif" }}
            >
              Reset Queries
            </button>
          )}

          {confirmReminder === user._id ? (
            <>
              <button
                onClick={() => onReminder(user._id)}
                disabled={sendingReminder === user._id}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--color-accent)', color: '#fff', opacity: sendingReminder === user._id ? 0.6 : 1 }}
              >
                {sendingReminder === user._id ? 'Sending…' : 'Send'}
              </button>
              <button
                onClick={onReminderCancel}
                disabled={sendingReminder === user._id}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => onReminderConfirm(user._id)}
              className="text-xs px-2 py-1 rounded"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontFamily: "'Sora', sans-serif" }}
            >
              Send Reminder
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [usersLoading, setUsersLoading] = useState(true)
  const [confirmReset, setConfirmReset] = useState<string | null>(null)
  const [confirmReminder, setConfirmReminder] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const limit = 20

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.isAdmin) router.replace('/dashboard')
  }, [session, status, router])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin/monitoring')
      setStats(await res.json())
    } catch {
      toast('Failed to load stats', 'error')
    } finally {
      setStatsLoading(false)
    }
  }, [toast])

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=${limit}`)
      const data = await res.json()
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } catch {
      toast('Failed to load users', 'error')
    } finally {
      setUsersLoading(false)
    }
  }, [page, toast])

  useEffect(() => {
    if (!session?.user?.isAdmin) return
    fetchStats()
    fetchUsers()
  }, [session, fetchStats, fetchUsers])

  const refreshAll = () => {
    fetchStats()
    fetchUsers()
  }

  const updateUser = async (id: string, patch: Record<string, unknown>) => {
    const prev = users
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

  const sendReminder = async (id: string) => {
    setSendingReminder(id)
    try {
      const res = await fetch(`/api/admin/users/${id}/send-reengage`, { method: 'POST' })
      if (res.ok) {
        toast('Reminder email sent', 'success')
      } else {
        const body = await res.json()
        toast(body.error ?? 'Failed to send email', 'error')
      }
    } catch {
      toast('Failed to send email', 'error')
    } finally {
      setSendingReminder(null)
      setConfirmReminder(null)
    }
  }

  if (status === 'loading' || !session?.user?.isAdmin) return null

  const totalPages = Math.ceil(total / limit)
  const loading = usersLoading

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
            Users
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {total} registered · live stats below
          </p>
        </div>
        <Button variant="outline" onClick={refreshAll} disabled={loading || statsLoading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', (loading || statsLoading) && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <StatCards stats={stats} loading={statsLoading} />

      {/* Desktop: table */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['User', 'Last Login', 'Verified', 'Tier', 'AI', 'Queries', 'Actions', ''].map(h => (
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
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--color-border)', width: j === 0 ? '120px' : '60px' }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : users.map((user) => (
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
                            {relativeTime(user.lastLogin ?? null)}
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

                        {/* Reset Queries */}
                        <td className="px-4 py-3">
                          {confirmReset === user._id ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => resetQueries(user._id)} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}>Confirm</button>
                              <button onClick={() => setConfirmReset(null)} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmReset(user._id)}
                              className="text-xs px-2 py-1 rounded"
                              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontFamily: "'Sora', sans-serif" }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-elevated)')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              Reset Queries
                            </button>
                          )}
                        </td>

                        {/* Send Reminder */}
                        <td className="px-4 py-3">
                          {confirmReminder === user._id ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => sendReminder(user._id)}
                                disabled={sendingReminder === user._id}
                                className="text-xs px-2 py-1 rounded"
                                style={{ backgroundColor: 'var(--color-accent)', color: '#fff', opacity: sendingReminder === user._id ? 0.6 : 1 }}
                              >
                                {sendingReminder === user._id ? 'Sending…' : 'Send'}
                              </button>
                              <button
                                onClick={() => setConfirmReminder(null)}
                                disabled={sendingReminder === user._id}
                                className="text-xs px-2 py-1 rounded"
                                style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmReminder(user._id)}
                              className="text-xs px-2 py-1 rounded"
                              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontFamily: "'Sora', sans-serif" }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-elevated)')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              Send Reminder
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            ))
          : users.length === 0
            ? <p className="py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>No users found.</p>
            : users.map((user) => (
                <UserCard
                  key={user._id}
                  user={user}
                  onUpdate={updateUser}
                  onResetConfirm={setConfirmReset}
                  onReminderConfirm={setConfirmReminder}
                  confirmReset={confirmReset}
                  confirmReminder={confirmReminder}
                  sendingReminder={sendingReminder}
                  onResetCancel={() => setConfirmReset(null)}
                  onReminderCancel={() => setConfirmReminder(null)}
                  onReset={resetQueries}
                  onReminder={sendReminder}
                />
              ))}
      </div>

      {/* Pagination */}
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
