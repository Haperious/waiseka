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

/**
 * Parse a user-supplied date string (e.g. 'yyyy-MM-dd' from a date input) into
 * a UTC Date anchored at noon (12:00:00.000Z).
 *
 * Why noon? A bare date string like '2025-05-15' parsed with `new Date()` is
 * treated as UTC midnight, which shifts to the previous calendar day for users
 * in UTC+ timezones (e.g. Qatar UTC+3 sees it as May 14 at 23:00 local time).
 * Anchoring to UTC noon gives a 12-hour buffer on both sides, safely keeping
 * the date on the correct calendar day for any timezone offset (UTC-12 to UTC+14).
 *
 * All API date-range queries use UTC midnight boundaries, so UTC noon dates
 * always fall cleanly within the correct day's window.
 */
export function parseTransactionDate(dateStr: string): Date {
  // If it already has a time component (e.g. full ISO from DB), parse as-is
  if (dateStr.includes('T')) return new Date(dateStr)
  // yyyy-MM-dd: anchor to UTC noon
  return new Date(`${dateStr}T12:00:00.000Z`)
}
