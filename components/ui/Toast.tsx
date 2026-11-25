'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error'

/** A button inside the toast, e.g. Undo. Clicking it also dismisses the toast. */
export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, action?: ToastAction) => void
}

const TOAST_MS = 4000
/** Longer when there's something to click, so there's time to reach it. */
const TOAST_WITH_ACTION_MS = 7000

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counterRef = useRef(0)

  const toast = useCallback((message: string, type: ToastType = 'success', action?: ToastAction) => {
    const id = ++counterRef.current
    setToasts((prev) => [...prev, { id, message, type, action }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, action ? TOAST_WITH_ACTION_MS : TOAST_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }: { toast: ToastItem; onRemove: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg max-w-sm w-full transition-all duration-300',
        toast.type === 'success'
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      {toast.type === 'success' ? (
        <CheckCircle className="h-5 w-5 shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0" />
      )}
      <p className="text-sm flex-1">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => { toast.action?.onClick(); onRemove() }}
          style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={onRemove} className="text-white/70 hover:text-white" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
