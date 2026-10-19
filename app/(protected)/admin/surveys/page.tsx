'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Star, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { useResource } from '@/hooks/useFetch'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SurveyEntry {
  _id: string
  rating: 1 | 2 | 3 | 4 | 5
  comment: string | null
  createdAt: string
  user: { name: string; email: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          fill={s <= rating ? 'var(--color-warning)' : 'transparent'}
          stroke={s <= rating ? 'var(--color-warning)' : 'var(--color-border)'}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

interface SurveyFilters {
  ratings: number[]
  from: string
  to: string
}

const NO_FILTERS: SurveyFilters = { ratings: [], from: '', to: '' }
const NO_SURVEYS: SurveyEntry[] = []

function filterParams(filters: SurveyFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.ratings.length) params.set('rating', filters.ratings.join(','))
  if (filters.from) params.set('from', filters.from)
  if (filters.to)   params.set('to', filters.to)
  return params
}

export default function AdminSurveysPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast: showToast } = useToast()

  const [page, setPage]         = useState(1)
  const [exporting, setExporting] = useState(false)

  // Filter inputs (a draft) and the filters actually applied to the list/export
  const [selectedRatings, setSelectedRatings] = useState<number[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')
  const [appliedFilters, setAppliedFilters] = useState(NO_FILTERS)

  // Redirect non-admins
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.isAdmin) router.replace('/dashboard')
  }, [session, status, router])

  const fetchSurveys = useCallback(async () => {
    const params = filterParams(appliedFilters)
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))
    const res = await fetch(`/api/admin/surveys?${params}`)
    if (!res.ok) throw new Error('Failed to fetch surveys')
    return res.json() as Promise<{ surveys: SurveyEntry[]; total: number }>
  }, [page, appliedFilters])

  const { data, loading, refetch } = useResource(fetchSurveys, {
    enabled: session?.user?.isAdmin === true,
    onError: () => showToast('Failed to load surveys', 'error'),
  })
  const surveys = data?.surveys ?? NO_SURVEYS
  const total = data?.total ?? 0

  const handleApplyFilters = () => {
    setAppliedFilters({ ratings: selectedRatings, from: fromDate, to: toDate })
    setPage(1)
  }

  const handleClearFilters = () => {
    setSelectedRatings([])
    setFromDate('')
    setToDate('')
    setAppliedFilters(NO_FILTERS)
    setPage(1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/admin/surveys/export?${filterParams(appliedFilters)}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `waiseka-surveys-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  const toggleRating = (r: number) => {
    setSelectedRatings((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (status === 'loading' || !session?.user?.isAdmin) return null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-text-primary)' }}>
            User Surveys
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {total.toLocaleString()} submission{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={refetch} disabled={loading}>
            <RefreshCw size={14} className={cn('mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} loading={exporting}>
            <Download size={14} className="mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Rating filter */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Rating</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => toggleRating(r)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
                    style={{
                      borderColor: selectedRatings.includes(r) ? 'var(--color-accent)' : 'var(--color-border)',
                      backgroundColor: selectedRatings.includes(r) ? 'var(--color-pale)' : 'var(--color-elevated)',
                      color: selectedRatings.includes(r) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <Star size={11} fill={selectedRatings.includes(r) ? 'var(--color-warning)' : 'transparent'} stroke="var(--color-warning)" strokeWidth={1.5} />
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>From</p>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm border focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-elevated)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>To</p>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm border focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-elevated)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <Button size="sm" onClick={handleApplyFilters}>Apply</Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearFilters}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
            </div>
          ) : surveys.length === 0 ? (
            <p className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No survey submissions found.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Date', 'User', 'Rating', 'Comment'].map((col) => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {surveys.map((s, idx) => (
                  <tr
                    key={s._id}
                    style={{
                      borderBottom: idx < surveys.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <td className="px-5 py-3 whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.user.name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.user.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StarDisplay rating={s.rating} />
                    </td>
                    <td className="px-5 py-3 max-w-xs" style={{ color: 'var(--color-text-primary)' }}>
                      {s.comment ? (
                        <span className="line-clamp-2 text-xs leading-relaxed">{s.comment}</span>
                      ) : (
                        <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>No comment</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
