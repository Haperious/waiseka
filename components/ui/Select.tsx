'use client'

import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <RadixSelect.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm',
            'bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
            'border-gray-300 dark:border-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
            error && 'border-red-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            className="z-50 min-w-[8rem] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
            position="popper"
            sideOffset={4}
            style={{ maxHeight: 'min(var(--radix-select-content-available-height), 280px)', width: 'var(--radix-select-trigger-width)' }}
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
                    'text-gray-900 dark:text-white',
                    'data-[highlighted]:bg-blue-50 dark:data-[highlighted]:bg-blue-900/30',
                    'data-[state=checked]:text-blue-600 dark:data-[state=checked]:text-blue-400'
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
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
