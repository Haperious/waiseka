export type CurrencyCode = 'PHP' | 'QAR' | 'USD'

export interface CurrencyInfo {
  code: CurrencyCode
  symbol: string
  label: string
  flag: string
}

const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  PHP: { code: 'PHP', symbol: '₱', label: 'Philippine Peso', flag: '🇵🇭' },
  QAR: { code: 'QAR', symbol: '﷼', label: 'Qatari Riyal', flag: '🇶🇦' },
  USD: { code: 'USD', symbol: '$', label: 'US Dollar', flag: '🇺🇸' },
}

export const CURRENCY_SYMBOL_MAP: Record<CurrencyCode, string> = {
  PHP: '₱',
  QAR: '﷼',
  USD: '$',
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOL_MAP[code as CurrencyCode] ?? '$'
}

export function formatAmount(amount: number, code: string): string {
  const symbol = getCurrencySymbol(code)
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${symbol} ${formatted}`
}

export function formatAmountShort(amount: number, code: string): string {
  const symbol = getCurrencySymbol(code)
  if (Math.abs(amount) >= 1000) {
    const shortened = (amount / 1000).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
    return `${symbol} ${shortened}K`
  }
  return `${symbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function getAllCurrencies(): CurrencyInfo[] {
  return Object.values(CURRENCIES)
}

export function getCurrencyInfo(code: string): CurrencyInfo {
  return CURRENCIES[code as CurrencyCode] ?? CURRENCIES.USD
}
