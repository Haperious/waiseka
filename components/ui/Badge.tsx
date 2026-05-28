import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'active' | 'completed' | 'paused' | 'savings'
}

const variantClasses: Record<string, string> = {
  default:   'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]',
  success:   'bg-[var(--color-income-bg)] text-[var(--color-income)]',
  active:    'bg-[var(--color-income-bg)] text-[var(--color-income)]',
  savings:   'bg-[var(--color-savings-bg)] text-[var(--color-savings)]',
  warning:   'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  paused:    'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  danger:    'bg-[var(--color-expense-bg)] text-[var(--color-expense)]',
  info:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

export default function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
