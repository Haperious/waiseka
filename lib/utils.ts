import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as a currency string using the given symbol.
 * e.g. formatCurrency(1234.5, '₱') => '₱1,234.50'
 */
export function formatCurrency(amount: number, currencySymbol: string): string {
  return `${currencySymbol}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}
