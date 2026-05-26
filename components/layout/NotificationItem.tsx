'use client'

import type { Notification } from '@/hooks/useNotifications'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

interface Props {
  notification: Notification
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
}

export default function NotificationItem({ notification, onMarkRead, onDelete }: Props) {
  const handleClick = () => {
    if (!notification.read) onMarkRead(notification._id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(notification._id)
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 14px',
        cursor: notification.read ? 'default' : 'pointer',
        backgroundColor: notification.read ? 'transparent' : 'var(--color-elevated)',
        borderBottom: '1px solid var(--color-border)',
        transition: 'background-color 0.15s',
      }}
    >
      {/* Colored dot */}
      <span
        style={{
          flexShrink: 0,
          marginTop: '4px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: notification.color,
          opacity: notification.read ? 0.4 : 1,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            fontFamily: "'Sora', sans-serif",
            color: 'var(--color-text-primary)',
            opacity: notification.read ? 0.5 : 1,
            lineHeight: '1.4',
            wordBreak: 'break-word',
          }}
        >
          {notification.message}
        </p>
        <span
          style={{
            display: 'block',
            marginTop: '3px',
            fontSize: '11px',
            fontFamily: "'DM Mono', monospace",
            color: 'var(--color-text-muted)',
            opacity: notification.read ? 0.5 : 1,
          }}
        >
          {relativeTime(notification.createdAt)}
        </span>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        aria-label="Delete notification"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '14px',
          color: 'var(--color-text-muted)',
          lineHeight: 1,
          opacity: 0.6,
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
      >
        ×
      </button>
    </div>
  )
}
