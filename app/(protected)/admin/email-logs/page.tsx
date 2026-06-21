'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Search, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import type { EmailLogType } from '@/lib/models/EmailLog'

const EMAIL_TYPES: { value: EmailLogType | ''; label: string }[] = [
  { value: '',                  label: 'All types' },
  { value: 'welcome',           label: 'Welcome' },
  { value: 'email_verification',label: 'Email Verification' },
  { value: 'reset_password',    label: 'Reset Password' },
  { value: 'setup_nudge',       label: 'Setup Nudge' },
  { value: 'budget_reminder',   label: 'Budget Reminder' },
  { value: 'spending_alert',    label: 'Spending Alert' },
  { value: 'monthly_report',    label: 'Monthly Report' },
  { value: 're_engage',         label: 'Re-Engage' },
  { value: 'savings_milestone', label: 'Savings Milestone' },
]

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  welcome:            { bg: 'var(--color-pale)',     text: 'var(--color-active)' },
  email_verification: { bg: 'var(--color-pale)',     text: 'var(--color-active)' },
  reset_password:     { bg: '#fff3cd',               text: '#856404' },
  setup_nudge:        { bg: '#e8f5e9',               text: '#2e7d32' },
  budget_reminder:    { bg: '#e3f2fd',               text: '#1565c0' },
  spending_alert:     { bg: '#fce4ec',               text: '#c62828' },
  monthly_report:     { bg: '#ede7f6',               text: '#4527a0' },
  re_engage:          { bg: '#fff8e1',               text: '#e65100' },
  savings_milestone:  { bg: '#e8f5e9',               text: '#2e7d32' },
}

interface EmailLog {
  _id: string
  userId: string
  type: EmailLogType
  category?: string
  sentAt: string
  userName: string | null
  userEmail: string | null
}

function relativeTime(dateStr: string): string {
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

function TypeBadge({ type }: { type: EmailLogType }) {
  const label = EMAIL_TYPES.find((t) => t.value === type)?.label ?? type
  const colors = TYPE_COLORS[type] ?? { bg: 'var(--color-elevated)', text: 'var(--color-text-secondary)' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: colors.bg, color: colors.text, fontFamily: "'Sora', sans-serif" }}
    >
      {label}
    </span>
  )
}

export default function AdminEmailLogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [logs, setLogs] = useState<EmailLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<EmailLogType | ''>('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const limit = 20

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.isAdmin) router.replace('/dashboard')
  }, [session, status, router])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (typeFilter) params.set('type', typeFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/email-logs?${params}`)
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
    } catch {
      toast('Failed to load email logs', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, search, toast])

  useEffect(() => {
    if (session?.user?.isAdmin) fetchLogs()
  }, [fetchLogs, session])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [typeFilter, search])

  const handleSearch = () => setSearch(searchInput)

  if (status === 'loading' || !session?.user?.isAdmin) return null

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
            Email Logs
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {total.toLocaleString()} total entries
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EmailLogType | '')}
          className="text-sm px-3 py-2 rounded-lg border focus:outline-none"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontFamily: "'Sora', sans-serif",
          }}
        >
          {EMAIL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                fontFamily: "'Sora', sans-serif",
              }}
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>Search</Button>
        </div>
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Sent', 'Type', 'Recipient', 'Category'].map((h) => (
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
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {[80, 120, 160, 60].map((w, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--color-border)', width: `${w}px` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : logs.map((log) => (
                      <tr
                        key={log._id}
                        className="transition-colors"
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-elevated)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Sent */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                            {relativeTime(log.sentAt)}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                            {new Date(log.sentAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <TypeBadge type={log.type} />
                        </td>

                        {/* Recipient */}
                        <td className="px-4 py-3">
                          {log.userName ? (
                            <>
                              <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
                                {log.userName}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                                {log.userEmail}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                              {log.userId}
                            </p>
                          )}
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3">
                          {log.category ? (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                              {log.category}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}

                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                      <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No email logs found.</p>
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
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            ))
          : logs.length === 0
            ? (
              <div className="py-16 text-center" style={{ color: 'var(--color-text-muted)' }}>
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No email logs found.</p>
              </div>
            )
            : logs.map((log) => (
              <Card key={log._id}>
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <TypeBadge type={log.type} />
                    <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                      {relativeTime(log.sentAt)}
                    </span>
                  </div>

                  {log.userName ? (
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: "'Sora', sans-serif" }}>
                        {log.userName}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                        {log.userEmail}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                      {log.userId}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>
                      {new Date(log.sentAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    {log.category && (
                      <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                        {log.category}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p style={{ color: 'var(--color-text-muted)' }}>Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>Previous</Button>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
