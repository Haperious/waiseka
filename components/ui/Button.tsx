import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, CSSProperties, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, style, children, ...props }, ref) => {
    const variantStyle: CSSProperties = {
      ...(variant === 'primary'   ? { backgroundColor: 'var(--color-primary)' } : {}),
      ...(variant === 'secondary' ? { backgroundColor: 'var(--color-elevated)', color: 'var(--color-text-primary)' } : {}),
      ...(variant === 'ghost'     ? { color: 'var(--color-text-secondary)' } : {}),
      ...(variant === 'outline'   ? { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' } : {}),
      ...(style ?? {}),
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={variantStyle}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
          {
            'text-white hover:opacity-90 focus-visible:ring-[var(--color-accent)]': variant === 'primary',
            'hover:opacity-80 focus-visible:ring-[var(--color-border)]': variant === 'secondary',
            'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500': variant === 'danger',
            'bg-transparent hover:opacity-80 focus-visible:ring-[var(--color-border)]': variant === 'ghost',
            'border bg-transparent hover:opacity-80 focus-visible:ring-[var(--color-border)]': variant === 'outline',
          },
          {
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
