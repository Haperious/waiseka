'use client'

import { forwardRef, InputHTMLAttributes, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const [show, setShow] = useState(false)

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={id}
            ref={ref}
            type={show ? 'text' : 'password'}
            className={cn(
              'h-10 w-full rounded-lg border px-3 pr-10 text-sm outline-none transition-colors',
              'placeholder:text-[var(--color-text-muted)]',
              'focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              className
            )}
            style={{
              backgroundColor: 'var(--color-elevated)',
              color: 'var(--color-text-primary)',
              borderColor: error ? undefined : 'var(--color-border)',
            }}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'

export default PasswordInput
