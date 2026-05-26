'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface Notification {
  _id: string
  userId: string
  type: 'budget_alert'
  category: string
  message: string
  color: string
  createdAt: string
  read: boolean
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/items/unread-count')
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(data.count ?? 0)
    } catch {
      // silent — polling failure shouldn't surface an error
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/notifications/items')
      if (!res.ok) throw new Error('Failed to load notifications')
      const data: Notification[] = await res.json()
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.read).length)
    } catch {
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + 60s polling of unread count
  useEffect(() => {
    fetchUnreadCount()
    intervalRef.current = setInterval(fetchUnreadCount, 60_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchUnreadCount])

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    const prev = notifications
    setNotifications(ns =>
      ns.map(n => (n._id === id ? { ...n, read: true } : n))
    )
    setUnreadCount(c => Math.max(0, c - 1))

    try {
      const res = await fetch(`/api/notifications/items/${id}`, { method: 'PATCH' })
      if (!res.ok) throw new Error()
    } catch {
      // Revert
      setNotifications(prev)
      setUnreadCount(prev.filter(n => !n.read).length)
      setError('Failed to mark notification as read')
    }
  }, [notifications])

  const markAllRead = useCallback(async () => {
    const prev = notifications
    const prevCount = unreadCount
    // Optimistic update
    setNotifications(ns => ns.map(n => ({ ...n, read: true })))
    setUnreadCount(0)

    try {
      const res = await fetch('/api/notifications/items/read-all', { method: 'PATCH' })
      if (!res.ok) throw new Error()
    } catch {
      setNotifications(prev)
      setUnreadCount(prevCount)
      setError('Failed to mark all notifications as read')
    }
  }, [notifications, unreadCount])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/items/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setNotifications(ns => ns.filter(n => n._id !== id))
      setUnreadCount(c => {
        const wasUnread = notifications.find(n => n._id === id && !n.read)
        return wasUnread ? Math.max(0, c - 1) : c
      })
    } catch {
      setError('Failed to delete notification')
    }
  }, [notifications])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
  }
}
