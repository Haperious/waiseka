import type { ITransaction } from '@/lib/models/Transaction'

// ─── Shared constants ──────────────────────────────────────────────────────

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTHS_PIPE = MONTH_NAMES.join('|')

// Plain amount: 1,234.56 or 1234 or 1,234
const PLAIN_AMOUNT_RE = /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g

// ─── Router ────────────────────────────────────────────────────────────────

export function parseTransactionsFromText(rawText: string): Partial<ITransaction>[] {
  if (detectBDO(rawText))     return parseBDO(rawText)
  if (detectGCash(rawText))   return parseGCash(rawText)
  if (detectGoTyme(rawText))  return parseGoTyme(rawText)
  if (detectCBQ(rawText))     return parseCBQ(rawText)
  // Add more bank detectors here as new formats are discovered:
  // if (detectBPI(rawText))  return parseBPI(rawText)

  // Generic: split on "DD MMM" boundaries (MariBank, and similar digital banks)
  const generic = parseByDayMonthBoundaries(rawText)
  if (generic.length > 0) return generic

  // Last resort: one transaction per line
  return parseLineByLine(rawText)
}

// ─── BDO ───────────────────────────────────────────────────────────────────
// Format: Mon DD, YYYY  |  Reference  |  Description  |  -PHP / PHP  Amount
// Amounts are explicitly signed: -PHP = outgoing, PHP = incoming

function detectBDO(text: string): boolean {
  const bdoDates = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/g)
  return /-?PHP\s+[\d,]+\.\d{2}/.test(text) && (bdoDates?.length ?? 0) >= 2
}

function parseBDO(rawText: string): Partial<ITransaction>[] {
  const flat = rawText.replace(/\s+/g, ' ')

  // "Apr 30, 2026" or "Jan 2, 2026"
  const DATE_RE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\b/gi

  type B = { index: number; raw: string; day: number; month: number; year: number }
  const bounds: B[] = []
  for (const m of flat.matchAll(DATE_RE)) {
    const month = MONTH_NAMES.indexOf(m[1].toUpperCase())
    if (month === -1) continue
    bounds.push({ index: m.index!, raw: m[0], day: parseInt(m[2]), month, year: parseInt(m[3]) })
  }
  if (bounds.length === 0) return []

  const transactions: Partial<ITransaction>[] = []

  for (let i = 0; i < bounds.length; i++) {
    const seg = flat.slice(bounds[i].index + bounds[i].raw.length, bounds[i + 1]?.index ?? flat.length).trim()

    // Amount is always "-PHP 1,000.00" or "PHP 0.12"
    const amtMatch = seg.match(/(-)?PHP\s+([\d,]+(?:\.\d{1,2})?)/)
    if (!amtMatch) continue

    const amount = parseFloat(amtMatch[2].replace(/,/g, ''))
    if (isNaN(amount) || amount === 0) continue

    const type: ITransaction['type'] = amtMatch[1] === '-' ? 'expense' : 'income'
    const descRaw = seg.slice(0, amtMatch.index!).trim()
    const description = cleanBDODescription(descRaw)
    if (!description) continue

    const { day, month, year } = bounds[i]
    const date = new Date(year, month, day)
    if (isNaN(date.getTime())) continue

    transactions.push({
      date: date.toISOString().split('T')[0] as unknown as Date,
      description,
      amount,
      type,
      category: inferCategory(description),
      tags: [],
      isRecurring: false,
    })
  }

  return transactions
}

function cleanBDODescription(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim()
  if (!s) return ''

  // Pure number prefix (account reference): "16229161428 Received from Other Bank"
  const numRef = s.match(/^\d[\d\s]*\s+([A-Za-z].+)/)
  if (numRef) return numRef[1].trim()

  // Find the first "human" word: uppercase letter followed by 2+ lowercase
  // This separates machine codes (all caps) from readable descriptions (Title Case)
  // e.g. "POB IBFT BN-20260413 Sent via InstaPay" → "Sent via InstaPay"
  const humanMatch = s.match(/\b([A-Z][a-z]{2,}.*)/)
  if (humanMatch) return humanMatch[1].trim()

  // Exact duplicate removal: "INTEREST WITHHELD INTEREST WITHHELD" → "INTEREST WITHHELD"
  // Works by checking if the second half of the string starts with the first half
  const words = s.split(' ')
  const half = Math.ceil(words.length / 2)
  const firstHalf = words.slice(0, half).join(' ')
  const lastHalf = words.slice(words.length - half).join(' ')
  if (lastHalf === firstHalf || lastHalf.startsWith(firstHalf)) return firstHalf

  return s
}

// ─── GCash ─────────────────────────────────────────────────────────────────
// Format: YYYY-MM-DD HH:MM  |  Description  |  13-digit Ref  |  Amount  |  Balance
// The Debit and Credit columns are omitted when empty; balance delta → type.

function detectGCash(text: string): boolean {
  return (
    /GCash Transaction History/i.test(text) ||
    (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text) && /Reference No\.?/i.test(text))
  )
}

function parseGCash(rawText: string): Partial<ITransaction>[] {
  const flat = rawText.replace(/\s+/g, ' ').trim()

  const startBalMatch = flat.match(/STARTING BALANCE\s+([\d,]+\.?\d*)/)
  let prevBalance: number | null = startBalMatch
    ? parseFloat(startBalMatch[1].replace(/,/g, ''))
    : null

  const DATE_RE = /\b(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}\b/g

  type B = { index: number; raw: string; date: string }
  const bounds: B[] = []
  for (const m of flat.matchAll(DATE_RE)) {
    bounds.push({ index: m.index!, raw: m[0], date: m[1] })
  }
  if (bounds.length === 0) return []

  const transactions: Partial<ITransaction>[] = []

  for (let i = 0; i < bounds.length; i++) {
    const seg = flat
      .slice(bounds[i].index + bounds[i].raw.length, bounds[i + 1]?.index ?? flat.length)
      .trim()

    // GCash reference numbers are always 13 digits
    const refMatch = seg.match(/\b\d{13}\b/)
    if (!refMatch) continue

    const descRaw = seg.slice(0, refMatch.index!).trim()
    const afterRef = seg.slice(refMatch.index! + refMatch[0].length).trim()

    // afterRef: "AMOUNT.XX   BALANCE.XX"
    const nums = [...afterRef.matchAll(/[\d,]+\.\d{2}/g)].map((m) =>
      parseFloat(m[0].replace(/,/g, ''))
    )
    if (nums.length < 2) continue

    const amount = nums[0]
    const balance = nums[nums.length - 1]
    if (isNaN(amount) || amount === 0) continue

    // Balance delta is the most reliable signal for debit vs credit
    let type: ITransaction['type'] = 'expense'
    if (prevBalance !== null) {
      const diff = balance - prevBalance
      if (Math.abs(diff - amount) < 0.02) type = 'income'
      else if (Math.abs(diff + amount) < 0.02) type = 'expense'
      else type = /received|cash.?in|cashback|reward|refund/i.test(descRaw) ? 'income' : 'expense'
    } else {
      type = /received|cash.?in|cashback|reward|refund/i.test(descRaw) ? 'income' : 'expense'
    }
    prevBalance = balance

    const description = cleanGCashDescription(descRaw, type)
    if (!description || description.length < 2) continue

    const date = new Date(bounds[i].date)
    if (isNaN(date.getTime())) continue

    transactions.push({
      date: date.toISOString().split('T')[0] as unknown as Date,
      description,
      amount,
      type,
      category: inferCategory(description),
      tags: [],
      isRecurring: false,
    })
  }

  return transactions
}

function cleanGCashDescription(raw: string, type: ITransaction['type']): string {
  // "Received GCash from BANK with account ending in XXXX and invno:..."
  const recvMatch = raw.match(/Received GCash from (.+?) with account ending/i)
  if (recvMatch) return `Received from ${recvMatch[1].trim()}`

  // "Transfer from SENDER to RECIPIENT" - shorten to the relevant party
  const xferMatch = raw.match(/Transfer from (\S+) to (\S+)/i)
  if (xferMatch) {
    return type === 'income' ? `Transfer from ${xferMatch[1]}` : `Transfer to ${xferMatch[2]}`
  }

  return raw.replace(/\s+/g, ' ').trim()
}

// ─── GoTyme Bank ───────────────────────────────────────────────────────────
// Format: MM-DD-YYYY  |  Details  |  Credits  |  Debits  |  Running Balance
// Both Credits and Debits columns are always present; one will be 0.00.

function detectGoTyme(text: string): boolean {
  return /GoTyme Bank/i.test(text) && /\b\d{2}-\d{2}-\d{4}\b/.test(text)
}

function parseGoTyme(rawText: string): Partial<ITransaction>[] {
  const flat = rawText.replace(/\s+/g, ' ').trim()

  // "MM-DD-YYYY" - note this is NOT ISO order (month first)
  const DATE_RE = /\b(\d{2})-(\d{2})-(\d{4})\b/g

  type B = { index: number; raw: string; month: number; day: number; year: number }
  const bounds: B[] = []
  for (const m of flat.matchAll(DATE_RE)) {
    bounds.push({
      index: m.index!,
      raw: m[0],
      month: parseInt(m[1]) - 1, // 0-based
      day: parseInt(m[2]),
      year: parseInt(m[3]),
    })
  }
  if (bounds.length === 0) return []

  const transactions: Partial<ITransaction>[] = []

  for (let i = 0; i < bounds.length; i++) {
    const seg = flat
      .slice(bounds[i].index + bounds[i].raw.length, bounds[i + 1]?.index ?? flat.length)
      .trim()

    // Collect all decimal amounts - last 3 are: credit, debit, running balance
    const nums = [...seg.matchAll(/[\d,]+\.\d{2}/g)].map((m) => ({
      index: m.index!,
      value: parseFloat(m[0].replace(/,/g, '')),
    }))
    if (nums.length < 3) continue

    const credit = nums[nums.length - 3].value
    const debit = nums[nums.length - 2].value
    if (credit === 0 && debit === 0) continue

    const amount = credit > 0 ? credit : debit
    const type: ITransaction['type'] = credit > 0 ? 'income' : 'expense'

    // Description is everything before the credit amount
    const descRaw = seg.slice(0, nums[nums.length - 3].index).trim()
    if (!descRaw || descRaw.length < 2) continue

    const description = cleanGoTymeDescription(descRaw)

    const { month, day, year } = bounds[i]
    const date = new Date(year, month, day)
    if (isNaN(date.getTime())) continue

    transactions.push({
      date: date.toISOString().split('T')[0] as unknown as Date,
      description,
      amount,
      type,
      category: inferCategory(description),
      tags: [],
      isRecurring: false,
    })
  }

  return transactions
}

function cleanGoTymeDescription(raw: string): string {
  let s = raw
  // "Card payment at MERCHANT ..., Card •••• XXXX" → "Card payment at MERCHANT ..."
  s = s.replace(/,?\s*Card\s+[•*]+\s+\d+/gi, '')
  // "... GoTyme Bank, Account No. ••••••••XXXX" → "... GoTyme Bank"
  s = s.replace(/,?\s*Account No\.\s+[•*\d]+/gi, '')
  return s.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim()
}

// ─── CBQ (Commercial Bank of Qatar) ────────────────────────────────────────
// Format: DD-Mon-YY (posting) | Description | DD-Mon-YY (tx) | Amount | Balance
// Two-digit year (26 → 2026). One amount column is always present (debit or credit);
// balance delta determines which it is.

function detectCBQ(text: string): boolean {
  return /\bCBQ\b/.test(text) && /\b\d{2}-[A-Za-z]{3}-\d{2}\b/.test(text)
}

function parseCBQ(rawText: string): Partial<ITransaction>[] {
  // Flatten whitespace, strip page column headers, strip BROUGHT FORWARD
  const flat = rawText
    .replace(/\s+/g, ' ')
    .replace(/\d+\/\d+\s+Posting Date\s+Transaction Description\s+Transaction Date\s+Debit\s+Credit\s+Balance\s*/gi, ' ')
    .replace(/\b\d{2}-[A-Za-z]{3}-\d{2}\s+BROUGHT FORWARD\s+[\d,]+\.\d{2}\s*/gi, ' ')
    .trim()

  // Extract opening balance separately for type detection
  const bfMatch = rawText.match(/BROUGHT FORWARD\s+([\d,]+\.\d{2})/)
  let prevBalance: number | null = bfMatch ? parseFloat(bfMatch[1].replace(/,/g, '')) : null

  // Each transaction: POSTING_DATE  DESCRIPTION  TX_DATE  AMOUNT  BALANCE
  // Non-greedy desc stops at the first subsequent DD-Mon-YY (the transaction date)
  const TX_RE = /\b(\d{2}-[A-Za-z]{3}-\d{2})\s+(.+?)\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/g

  const transactions: Partial<ITransaction>[] = []

  for (const m of flat.matchAll(TX_RE)) {
    const descRaw = m[2].trim()
    if (/BROUGHT FORWARD/i.test(descRaw)) continue

    const amount  = parseFloat(m[4].replace(/,/g, ''))
    const balance = parseFloat(m[5].replace(/,/g, ''))
    if (isNaN(amount) || amount === 0) continue

    let type: ITransaction['type'] = 'expense'
    if (prevBalance !== null) {
      const diff = balance - prevBalance
      if      (Math.abs(diff - amount) < 0.02) type = 'income'
      else if (Math.abs(diff + amount) < 0.02) type = 'expense'
      else    type = /salary|credit reversal|transfer from|received/i.test(descRaw) ? 'income' : 'expense'
    } else {
      type = /salary|credit reversal|transfer from|received/i.test(descRaw) ? 'income' : 'expense'
    }
    prevBalance = balance

    // Use transaction date (m[3]) - the actual activity date, not the posting date
    const dp = m[3].match(/(\d{2})-([A-Za-z]{3})-(\d{2})/)
    if (!dp) continue
    const month = MONTH_NAMES.indexOf(dp[2].toUpperCase())
    if (month === -1) continue
    const date = new Date(2000 + parseInt(dp[3]), month, parseInt(dp[1]))
    if (isNaN(date.getTime())) continue

    const description = cleanCBQDescription(descRaw)
    if (!description || description.length < 2) continue

    transactions.push({
      date: date.toISOString().split('T')[0] as unknown as Date,
      description,
      amount,
      type,
      category: inferCategory(description),
      tags: [],
      isRecurring: false,
    })
  }

  return transactions
}

function cleanCBQDescription(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim()

  if (/TRANSFER FROM OWN ACCO/i.test(s)) return 'Transfer from Own Account'
  if (/TRANSFER TO OWN ACCOUN/i.test(s)) return 'Transfer to Own Account'

  const xferTo = s.match(/Transfer To\s+\d+\s+(.+)/i)
  if (xferTo) return `Transfer to ${xferTo[1].trim()}`

  const xferFrom = s.match(/Transfer From\s+\d+\s+(.+)/i)
  if (xferFrom) return `Transfer from ${xferFrom[1].trim()}`

  if (/ATM CASH WITHDRAWAL/i.test(s)) return 'ATM Cash Withdrawal'

  if (/SALARY TRANSFER/i.test(s)) {
    const employer = s.match(/SALARY FOR\s+\d+\s+(?:BO\s+)?(.+)/i)
    return employer ? `Salary - ${employer[1].trim()}` : 'Salary Transfer'
  }

  if (/LOAN REPAYMENT/i.test(s))  return 'Loan Repayment'
  if (/TRANSFER CHARGE/i.test(s)) return 'Transfer Charge'
  if (/CREDIT REVERSAL/i.test(s)) return 'Credit Reversal'

  const tahweel = s.match(/OUTGOING TAHWEEL\s+\w+\s+\S+\s+(.+)/i)
  if (tahweel) return `Tahweel: ${tahweel[1].trim()}`

  // ELECTRON AUTH: merchant is between the auth code and "CARD NO"
  const electron = s.match(/ELECTRON AUTH\s+\d+\s+(.+?)\s+CARD NO/i)
  if (electron) return electron[1].trim()

  // CBQ / NAPS PURCHASE: strip ref code + card BIN + card ending + location
  const purchase = s.match(/(?:CBQ|NAPS)\s+PURCHASE\s+\S+\s+(.*)/i)
  if (purchase) {
    let rest = purchase[1]
    rest = rest.replace(/\s*\d{5,}XXXXXXX\S*.*$/, '')  // strip card-ending pattern onwards
    rest = rest.replace(/^4018\s+\d+\s+\d+\s+/, '')    // strip leading card BIN
    rest = rest.replace(/\s+[Dd][Oo][Hh][Aa]\s*$/, '') // strip trailing DOHA/doha
    return rest.replace(/\s+/g, ' ').trim()
  }

  return s
}

// ─── MariBank / generic DD-MMM format ─────────────────────────────────────
// Format: entire page is one long line; transactions embedded as:
//   DD MMM   Description   Transaction-Type   Amount
// Amount is always last; type inferred from "Card Payment" / "Reward" / "Transfer"

const MARIBANK_TX_TYPES: { re: RegExp; type: ITransaction['type'] }[] = [
  { re: /\bcard\s+payment\b/i,          type: 'expense' },
  { re: /\bdebit\s+card\s+cashback\b/i, type: 'income'  },
  { re: /\breward\b/i,                   type: 'income'  },
  { re: /\bnet\s+interest\b/i,           type: 'income'  },
  { re: /\binterest\b/i,                 type: 'income'  },
  { re: /\btransfer\b/i,                 type: 'expense' },
]

function parseByDayMonthBoundaries(rawText: string): Partial<ITransaction>[] {
  const flat = rawText.replace(/\s+/g, ' ')

  // Extract the document year (first 4-digit year found)
  const yearMatch = flat.match(/\b(20\d{2})\b/)
  const docYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  // Matches "01 APR" or "01 APR 2026"
  const DATE_RE = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS_PIPE})(?:\\s+(\\d{4}))?\\b`, 'gi')

  type B = { index: number; raw: string; day: number; month: number; year: number }
  const bounds: B[] = []
  for (const m of flat.matchAll(DATE_RE)) {
    const month = MONTH_NAMES.indexOf(m[2].toUpperCase())
    if (month === -1) continue
    bounds.push({
      index: m.index!,
      raw: m[0],
      day: parseInt(m[1]),
      month,
      year: m[3] ? parseInt(m[3]) : docYear,
    })
  }
  if (bounds.length === 0) return []

  const transactions: Partial<ITransaction>[] = []

  for (let i = 0; i < bounds.length; i++) {
    const seg = flat.slice(bounds[i].index + bounds[i].raw.length, bounds[i + 1]?.index ?? flat.length).trim()

    // Skip balance/interest-table rows: segment starts with a digit (no description text)
    if (/^\d/.test(seg)) continue

    const amounts = [...seg.matchAll(PLAIN_AMOUNT_RE)].map((m) => ({
      index: m.index!,
      value: parseFloat(m[0].replace(/,/g, '')),
    }))
    if (amounts.length === 0) continue

    // Transaction amount = LAST number in the segment
    const txAmt = amounts[amounts.length - 1]
    if (isNaN(txAmt.value) || txAmt.value === 0) continue

    const descRaw = seg.slice(0, txAmt.index).trim()
    if (!descRaw || descRaw.length < 2) continue

    // Determine income/expense from transaction type keyword
    let type: ITransaction['type'] = 'expense'
    for (const t of MARIBANK_TX_TYPES) {
      if (t.re.test(descRaw)) { type = t.type; break }
    }

    // Clean description by stripping the transaction-type suffix
    const cleanDesc = MARIBANK_TX_TYPES
      .reduce((s, t) => s.replace(t.re, ''), descRaw)
      .replace(/\s+/g, ' ')
      .trim()

    const { day, month, year } = bounds[i]
    const date = new Date(year, month, day)
    if (isNaN(date.getTime())) continue

    transactions.push({
      date: date.toISOString().split('T')[0] as unknown as Date,
      description: cleanDesc || descRaw,
      amount: txAmt.value,
      type,
      category: inferCategory(cleanDesc || descRaw),
      tags: [],
      isRecurring: false,
    })
  }

  return transactions
}

// ─── Line-by-line fallback ─────────────────────────────────────────────────
// For well-structured PDFs where each line is one transaction starting with a date

function parseLineByLine(rawText: string): Partial<ITransaction>[] {
  const lines = rawText.split('\n').filter((l) => l.trim().length > 5)
  const transactions: Partial<ITransaction>[] = []

  const DATE_PATTERNS = [
    /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/,
    /^(\d{4}[\/\-]\d{2}[\/\-]\d{2})/,
    /^(\d{1,2}[\s\-][A-Za-z]{3}[\s\-]?\d{0,4})/,
    /^([A-Za-z]{3}\.?\s+\d{1,2}(?:[,\s]+\d{4})?)/,
  ]

  for (const line of lines) {
    const trimmed = line.trim()
    let dateStr: string | null = null
    let rest = trimmed

    for (const p of DATE_PATTERNS) {
      const m = trimmed.match(p)
      if (m) { dateStr = m[1]; rest = trimmed.slice(m[0].length).trim(); break }
    }
    if (!dateStr) continue

    const amounts = [...rest.matchAll(PLAIN_AMOUNT_RE)].map((m) => ({
      index: m.index!,
      value: parseFloat(m[0].replace(/,/g, '')),
    }))
    if (amounts.length === 0) continue

    const first = amounts[0]
    const description = rest.slice(0, first.index).trim()
    if (!description || description.length < 2) continue

    const amount = first.value
    if (isNaN(amount) || amount === 0) continue

    transactions.push({
      date: normalizeDate(dateStr) as unknown as Date,
      description,
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      category: inferCategory(description),
      tags: [],
      isRecurring: false,
    })
  }

  return transactions
}

// ─── Shared utilities ──────────────────────────────────────────────────────

export function inferCategory(description: string): string {
  const d = description.toLowerCase()
  if (/grab|uber|mrt|lrt|bus|jeep|taxi|angkas|transport|commute|cebu.?air|airline|flight|naia|airport/.test(d)) return 'Transport'
  if (/jollibee|mcdo|mcdonald|wendys|popeyes|kfc|pizza|burger|chow|thai|japanese|korean|chinese|mandarin.tea|sichu|sibyullee|tokyo|fogo|pancake|la.chick|food|eat|restaurant|cafe|kain|lunch|dinner|breakfast|groceri|grocery|supermarket|hypermarket|puregold|savemore|sm.market|s&r|mr.diy|keeta|talabat/.test(d)) return 'Food & Dining'
  if (/shopee|lazada|amazon|shein|disney|jisulife|shop|mall|department|store|steam/.test(d)) return 'Shopping'
  if (/meralco|maynilad|water|electric|internet|pldt|globe|smart|converge|skycable|telco|bill|google.one|service.charge|ooredoo|insurance|loan.repay|mofa/.test(d)) return 'Bills & Utilities'
  if (/salary|payroll|paycheck|wages/.test(d)) return 'Salary'
  if (/gcash|maya|palawan|remit|transfer|send|instapay|pesonet|received.from|sent.via|tahweel|atm.cash|cash.withdrawal/.test(d)) return 'Transfer'
  if (/savings|save|piggy|fund/.test(d)) return 'Savings'
  if (/hospital|clinic|pharmacy|medic|health|doctor|mercury/.test(d)) return 'Health'
  if (/netflix|spotify|youtube|apple|exitlag|discord|canva|subscription|premium|airalo|yesim/.test(d)) return 'Subscriptions'
  return 'Others'
}

function normalizeDate(raw: string): string {
  const year = new Date().getFullYear()
  for (const attempt of [raw, `${raw} ${year}`]) {
    const d = new Date(attempt)
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) return d.toISOString().split('T')[0]
  }
  const md = raw.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
  if (md) {
    const d = new Date(year, parseInt(md[1]) - 1, parseInt(md[2]))
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return new Date().toISOString().split('T')[0]
}
