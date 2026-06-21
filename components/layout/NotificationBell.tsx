'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import NotificationItem from './NotificationItem'

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const hasFetched = useRef(false)

  const {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
  } = useNotifications()

  // Compute fixed panel position from button's viewport rect on open
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const panelWidth = Math.min(360, window.innerWidth - 16)
      // Align right edge of panel with right edge of button, but clamp so left edge stays on screen
      const rightFromViewport = window.innerWidth - rect.right
      const maxRight = window.innerWidth - panelWidth - 8
      setPanelPos({
        top: rect.bottom + 8,
        right: Math.min(rightFromViewport, maxRight),
      })
    }
    if (!isOpen) setPanelPos(null)
  }, [isOpen])

  // Recompute on resize/scroll while open
  useEffect(() => {
    if (!isOpen) return
    const update = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        const panelWidth = Math.min(360, window.innerWidth - 16)
        const rightFromViewport = window.innerWidth - rect.right
        const maxRight = window.innerWidth - panelWidth - 8
        setPanelPos({ top: rect.bottom + 8, right: Math.min(rightFromViewport, maxRight) })
      }
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [isOpen])

  // Fetch full list when dropdown opens (once per open)
  useEffect(() => {
    if (isOpen && !hasFetched.current) {
      fetchNotifications()
      hasFetched.current = true
    }
    if (!isOpen) hasFetched.current = false
  }, [isOpen, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const hasUnread = unreadCount > 0

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(o => !o)}
        className="p-2 rounded-lg transition-opacity hover:opacity-70"
        style={{ position: 'relative', color: 'var(--color-text-secondary)' }}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              minWidth: '16px',
              height: '16px',
              padding: '0 3px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-expense)',
              color: '#fff',
              fontSize: '10px',
              fontFamily: "'DM Mono', monospace",
              fontWeight: 700,
              lineHeight: '16px',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — fixed so it never clips outside the viewport */}
      {isOpen && panelPos && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: panelPos.top,
            right: panelPos.right,
            width: 'min(360px, calc(100vw - 16px))',
            maxHeight: '480px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontFamily: "'Sora', sans-serif",
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Notifications
            </span>
            {hasUnread && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: "'Sora', sans-serif",
                  color: 'var(--color-accent)',
                  padding: '2px 0',
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && (
              <p
                style={{
                  margin: 0,
                  padding: '24px 14px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontFamily: "'Sora', sans-serif",
                  color: 'var(--color-text-muted)',
                }}
              >
                Loading…
              </p>
            )}

            {!loading && error && (
              <p
                style={{
                  margin: 0,
                  padding: '24px 14px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontFamily: "'Sora', sans-serif",
                  color: 'var(--color-expense)',
                }}
              >
                {error}
              </p>
            )}

            {!loading && !error && notifications.length === 0 && (
              <p
                style={{
                  margin: 0,
                  padding: '32px 14px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontFamily: "'Sora', sans-serif",
                  color: 'var(--color-text-muted)',
                }}
              >
                No notifications
              </p>
            )}

            {!loading &&
              !error &&
              notifications.map(n => (
                <NotificationItem
                  key={n._id}
                  notification={n}
                  onMarkRead={markRead}
                  onDelete={deleteNotification}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
