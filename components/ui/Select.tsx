'use client'

import { useId, useRef } from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isEmptyValueEcho } from '@/lib/selectEcho'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  label?: string
  error?: string
  className?: string
  disabled?: boolean
  /** `token`: colours from the theme CSS variables, matching the redesigned forms. */
  tone?: 'default' | 'token'
}

export default function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  label,
  error,
  className,
  disabled,
  tone = 'default',
}: SelectProps) {
  const token = tone === 'token'
  const openRef = useRef(false)
  // The trigger is a button, not a form control, so <label> alone doesn't name it for screen readers
  const labelId = useId()

  const handleValueChange = (next: string) => {
    if (isEmptyValueEcho(next, value, openRef.current)) return
    onValueChange(next)
  }

  return (
    <div className={cn('flex flex-col', token ? 'gap-1.5' : 'gap-1')}>
      {label && (
        <label
          id={labelId}
          className={cn('text-sm font-medium', !token && 'text-gray-700 dark:text-gray-300')}
          style={token ? { color: 'var(--color-text-secondary)' } : undefined}
        >
          {label}
        </label>
      )}
      <RadixSelect.Root
        value={value || undefined}
        onValueChange={handleValueChange}
        onOpenChange={(open) => { openRef.current = open }}
        disabled={disabled}
      >
        <RadixSelect.Trigger
          aria-labelledby={label ? labelId : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm',
            token
              ? 'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-sage)]'
              : [
                  'bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                  'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                ],
            error && 'border-red-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          style={
            token
              ? {
                  backgroundColor: 'var(--color-elevated)',
                  color: 'var(--color-text-primary)',
                  borderColor: error ? 'var(--color-expense)' : 'var(--color-border)',
                }
              : undefined
          }
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            className={cn(
              'z-50 min-w-[8rem] overflow-hidden rounded-lg border shadow-lg',
              !token && 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            )}
            position="popper"
            sideOffset={4}
            style={{
              maxHeight: 'min(var(--radix-select-content-available-height), 280px)',
              width: 'var(--radix-select-trigger-width)',
              ...(token ? { backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' } : {}),
            }}
          >
            <RadixSelect.ScrollUpButton className="flex items-center justify-center py-1 text-gray-400 cursor-default">
              <ChevronUp className="h-4 w-4" />
            </RadixSelect.ScrollUpButton>
            <RadixSelect.Viewport className="p-1 overflow-y-auto" style={{ maxHeight: 'min(var(--radix-select-content-available-height, 280px), 260px)' }}>
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center rounded-md px-8 py-2 text-sm outline-none',
                    token
                      ? 'text-[var(--color-text-primary)] data-[highlighted]:bg-[var(--color-sage)] data-[state=checked]:text-[var(--color-accent)] data-[state=checked]:font-semibold'
                      : [
                          'text-gray-900 dark:text-white',
                          'data-[highlighted]:bg-blue-50 dark:data-[highlighted]:bg-blue-900/30',
                          'data-[state=checked]:text-blue-600 dark:data-[state=checked]:text-blue-400',
                        ]
                  )}
                >
                  <RadixSelect.ItemIndicator className="absolute left-2">
                    <Check className="h-4 w-4" />
                  </RadixSelect.ItemIndicator>
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
            <RadixSelect.ScrollDownButton className="flex items-center justify-center py-1 text-gray-400 cursor-default">
              <ChevronDown className="h-4 w-4" />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error &&
        (token ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-expense)', margin: 0 }}>{error}</p>
        ) : (
          <p className="text-xs text-red-500">{error}</p>
        ))}
    </div>
  )
}
