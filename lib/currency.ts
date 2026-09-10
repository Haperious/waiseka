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

// Some currency symbols (e.g. QAR's ﷼) are treated as RTL characters by the
// Unicode bidi algorithm, which can visually reorder the leading "-" to the
// end of the string. Wrapping the whole thing in an LTR isolate (U+2066 /
// U+2069) forces the sign to always render first, regardless of currency.
function ltrIsolate(s: string): string {
  return `⁦${s}⁩`
}

export function formatAmount(amount: number, code: string): string {
  const symbol = getCurrencySymbol(code)
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return ltrIsolate(`${sign}${symbol} ${abs}`)
}

export function formatAmountShort(amount: number, code: string): string {
  const symbol = getCurrencySymbol(code)
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  if (abs >= 1000) {
    const shortened = (abs / 1000).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
    return ltrIsolate(`${sign}${symbol} ${shortened}K`)
  }
  return ltrIsolate(`${sign}${symbol} ${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`)
}

export function getAllCurrencies(): CurrencyInfo[] {
  return Object.values(CURRENCIES)
}
