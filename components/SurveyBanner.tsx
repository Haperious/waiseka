'use client'

import { useState, useEffect } from 'react'
import { Star, X, MessageSquarePlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const DISMISSED_KEY_PREFIX = 'waiseka_survey_dismissed_'

interface SurveyBannerProps {
  userId: string
  accountCreatedAt: string // ISO string
}

export default function SurveyBanner({ userId, accountCreatedAt }: SurveyBannerProps) {
  const { toast: showToast } = useToast()

  const [visible, setVisible] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const dismissedKey = `${DISMISSED_KEY_PREFIX}${userId}`

  useEffect(() => {
    const dismissed = localStorage.getItem(dismissedKey) === 'true'
    if (dismissed) return

    const daysSinceCreation =
      (Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceCreation >= 7) {
      setVisible(true)
      setShowForm(true)
    }
  }, [userId, accountCreatedAt, dismissedKey])

  const handleDismiss = () => {
    localStorage.setItem(dismissedKey, 'true')
    setVisible(false)
    setShowForm(false)
  }

  const handleOpenFeedback = () => {
    setRating(0)
    setComment('')
    setShowForm(true)
    setVisible(true)
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast('Please select a rating before submitting.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to submit feedback')
      }

      showToast('Thanks for your feedback! 🎉', 'success')
      localStorage.setItem(dismissedKey, 'true')
      setVisible(false)
      setShowForm(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Persistent re-open button (shown after dismissal)
  if (!visible) {
    return (
      <button
        onClick={handleOpenFeedback}
        className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-secondary)' }}
        aria-label="Give feedback"
      >
        <MessageSquarePlus size={14} />
        Give Feedback
      </button>
    )
  }

  if (!showForm) return null

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
              How are you finding WaiseKa?
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Your feedback helps us improve. Takes 30 seconds.
            </p>

            {/* Star rating */}
            <div className="flex gap-1 mb-4" role="group" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    size={24}
                    fill={(hovered || rating) >= star ? 'var(--color-warning)' : 'transparent'}
                    stroke={(hovered || rating) >= star ? 'var(--color-warning)' : 'var(--color-text-muted)'}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            {/* Comment textarea */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Any comments or suggestions? (optional)"
              className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 transition-colors"
              style={{
                backgroundColor: 'var(--color-elevated)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--color-text-muted)' }}>
              {comment.length}/500
            </p>

            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleSubmit} loading={submitting} disabled={rating === 0}>
                Submit Feedback
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                Dismiss
              </Button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="mt-0.5 shrink-0 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Close feedback banner"
          >
            <X size={16} />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
