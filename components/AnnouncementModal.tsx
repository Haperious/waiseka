'use client'

import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Image from 'next/image'
import Link from 'next/link'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'
import { cn } from '@/lib/utils'

export interface PendingAnnouncement {
  key: string
  title: string
  description: string
  imagePath: string
  imageAlt: string
  ctaLabel: string | null
  ctaHref: string | null
}

interface AnnouncementModalProps {
  open: boolean
  announcements: PendingAnnouncement[]
  onClose: () => void
}

/**
 * Carousel modal for unseen feature announcements. Built on Radix Dialog primitives
 * rather than the generic components/ui/Modal.tsx, which hardcodes gray-scale Tailwind
 * colors that don't respect WaiseKa's theme tokens and doesn't fit a full-bleed 16:9
 * image layout. See PRD-announcement-popup-2026-07.md §6.0.
 */
export default function AnnouncementModal({ open, announcements, onClose }: AnnouncementModalProps) {
  const { t } = useLanguage()
  const [index, setIndex] = useState(0)
  const viewedIndices = useRef(new Set<number>())

  const current = announcements[index]
  const isLast = index === announcements.length - 1

  function postView(position: number, dismissed: boolean) {
    const item = announcements[position]
    if (!item) return
    if (!dismissed && viewedIndices.current.has(position)) return
    viewedIndices.current.add(position)

    fetch(`/api/announcements/${item.key}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'carousel', position, dismissed }),
    }).catch(() => {
      // Never block carousel navigation on a failed view write.
    })
  }

  function resetAndClose() {
    setIndex(0)
    viewedIndices.current = new Set()
    onClose()
  }

  function handleNext() {
    postView(index, false)
    if (isLast) {
      resetAndClose()
    } else {
      setIndex((i) => i + 1)
    }
  }

  function handleBack() {
    setIndex((i) => Math.max(0, i - 1))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Any dismissal path Radix funnels through here: ESC, backdrop click, and the
      // X close button all call onOpenChange(false) - this is the single place that
      // marks the currently-visible card as dismissed. "Got it" on the final card
      // bypasses this via resetAndClose() directly, since completing the carousel
      // is not the same as abandoning it early.
      postView(index, true)
      resetAndClose()
    }
  }

  if (!current) return null

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-backdrop)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed z-50 inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto',
            'w-full sm:max-w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2',
            'rounded-t-2xl sm:rounded-2xl border overflow-hidden shadow-xl',
            'flex flex-col max-h-[92vh]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom',
            'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95'
          )}
          style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        >
          <Dialog.Close
            className="absolute right-3 top-3 z-10 rounded-md p-1.5 transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-surface-blur)' }}
            aria-label={t('announcements.close')}
          >
            <X className="h-4 w-4" />
          </Dialog.Close>

          <div className="overflow-y-auto">
            <div
              className="relative w-full overflow-hidden border-b"
              style={{ aspectRatio: '16 / 9', borderColor: 'var(--color-border)' }}
            >
              <Image
                src={current.imagePath}
                alt={current.imageAlt}
                width={1200}
                height={675}
                className="h-full w-full object-cover"
                priority
              />
            </div>

            <div className="p-5 sm:p-6">
              <Dialog.Title
                className="mb-2"
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.3,
                }}
              >
                {current.title}
              </Dialog.Title>
              <Dialog.Description
                className="mb-4"
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {current.description}
              </Dialog.Description>

              {current.ctaHref && current.ctaLabel && (
                <Link
                  href={current.ctaHref}
                  onClick={() => {
                    // Following the CTA counts as completing this card, same as "Got it" -
                    // it must not reappear on the user's next dashboard load.
                    postView(index, false)
                    resetAndClose()
                  }}
                  className="mb-4 inline-block text-sm font-medium hover:opacity-80"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {current.ctaLabel} &rarr;
                </Link>
              )}

              {announcements.length > 1 && (
                <div className="mb-4 flex items-center justify-center gap-2" role="tablist">
                  {announcements.map((a, i) => (
                    <button
                      key={a.key}
                      type="button"
                      role="tab"
                      onClick={() => setIndex(i)}
                      aria-label={t('announcements.goToCard').replace('{n}', String(i + 1))}
                      aria-current={i === index}
                      className="h-2 w-2 rounded-full transition-colors"
                      style={{
                        backgroundColor: i === index ? 'var(--color-accent)' : 'var(--color-border)',
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {index > 0 && (
                  <Button variant="ghost" size="lg" onClick={handleBack} className="w-full sm:w-auto">
                    {t('announcements.back')}
                  </Button>
                )}
                <Button variant="primary" size="lg" onClick={handleNext} className="w-full sm:w-auto">
                  {isLast ? t('announcements.gotIt') : t('announcements.next')}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
