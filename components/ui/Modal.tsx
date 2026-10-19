'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  /**
   * `form`: the redesigned form shell - card surface, bordered header, no body padding.
   * Children supply their own scrolling body and pinned footer (see FormModalLayout).
   */
  variant?: 'default' | 'form'
}

export default function Modal({ open, onClose, title, description, children, className, variant = 'default' }: ModalProps) {
  if (variant === 'form') {
    return (
      <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            style={{ backgroundColor: 'var(--color-backdrop)' }}
          />
          <Dialog.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
              'flex flex-col max-h-[90vh] overflow-hidden',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              className
            )}
            style={{
              backgroundColor: 'var(--color-card)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '18px 24px',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0,
              }}
            >
              {title && (
                <Dialog.Title style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                  {title}
                </Dialog.Title>
              )}
              <Dialog.Close
                onClick={onClose}
                className="ml-auto rounded-md p-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Close"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
            {description && (
              <Dialog.Description style={{ padding: '12px 24px 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                {description}
              </Dialog.Description>
            )}
            <div className="flex flex-1 min-h-0 flex-col">{children}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl',
            'flex flex-col max-h-[90vh]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            className
          )}
        >
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            {title && (
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </Dialog.Title>
            )}
            <Dialog.Close
              onClick={onClose}
              className="ml-auto rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-shrink-0">
              {description}
            </Dialog.Description>
          )}
          <div className="flex-1 overflow-y-auto min-h-0">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
