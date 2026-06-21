import { forwardRef, InputHTMLAttributes, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, onClick, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement>(null)

    const resolvedRef = (node: HTMLInputElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
    }

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLInputElement>) => {
        if (props.type === 'date' && innerRef.current) {
          try {
            innerRef.current.showPicker()
          } catch {
            // showPicker() not supported in all browsers - falls back to native behavior
          }
        }
        onClick?.(e)
      },
      [props.type, onClick]
    )

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
        <input
          id={id}
          ref={resolvedRef}
          onClick={handleClick}
          className={cn(
            'h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors',
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
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
