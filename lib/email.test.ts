import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture what would be sent instead of talking to SMTP
const sent: { to: string; subject: string; html: string }[] = []
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { to: string; subject: string; html: string }) => { sent.push(m) },
    }),
  },
}))

const { sendBudgetReminderEmail, sendMonthlyReportEmail } = await import('./email')

beforeEach(() => { sent.length = 0 })

/*
 * Single-currency snapshots, recorded before the multi-currency email change (PRD
 * Phase 5). A single-currency user's email must stay byte-identical, so these must
 * keep matching after any per-currency refactor - don't update them casually.
 */
describe('single-currency email HTML', () => {
  it('budget reminder', async () => {
    await sendBudgetReminderEmail({
      firstName: 'Justin',
      email: 'test@example.com',
      monthName: 'October',
      daysRemaining: 16,
      usedPercent: 42,
      totalIncome: '﷼12,000.00',
      totalSpent: '﷼4,200.00',
      totalRemaining: '﷼7,800.00',
      categories: [
        { name: 'Food & Dining', usedPercent: 80, spent: '﷼400.00', limit: '﷼500.00' },
        { name: 'Transportation', usedPercent: 20, spent: '﷼60.00', limit: '﷼300.00' },
      ],
      alertCategory: 'Food & Dining',
      projectedOverage: '﷼150.00',
    })
    expect(sent).toHaveLength(1)
    expect(sent[0].subject).toBe('Your October budget check-in')
    expect(sent[0].html).toMatchSnapshot()
  })

  it('monthly report', async () => {
    await sendMonthlyReportEmail({
      firstName: 'Justin',
      email: 'test@example.com',
      monthName: 'September',
      year: '2026',
      nextMonthName: 'October',
      totalIncome: '﷼12,000.00',
      totalSpent: '﷼8,000.00',
      totalSaved: '﷼4,000.00',
      categoriesOnBudget: 3,
      totalCategories: 4,
      topCategories: [
        { name: 'Housing', txnCount: 1, totalSpent: '﷼3,500.00', dotColor: '#f97316' },
        { name: 'Food & Dining', txnCount: 12, totalSpent: '﷼1,200.00', dotColor: '#3b82f6' },
      ],
      insight: {
        comparedCategory: 'Housing',
        changePercent: 5,
        changeDirection: 'dropped',
        comparedMonth: 'August',
        monthlySavingsFree: '﷼175.00',
      },
    })
    expect(sent).toHaveLength(1)
    expect(sent[0].subject).toBe('Your September 2026 financial report')
    expect(sent[0].html).toMatchSnapshot()
  })
})

describe('multi-currency email HTML', () => {
  const section = (currency: string, sym: string) => ({
    currency,
    usedPercent: 50,
    totalIncome: `${sym}1,000.00`,
    totalSpent: `${sym}500.00`,
    totalRemaining: `${sym}500.00`,
    categories: [{ name: 'Food & Dining', usedPercent: 50, spent: `${sym}250.00`, limit: `${sym}500.00` }],
  })

  it('budget reminder: one email, one section per currency, no combined percentage', async () => {
    await sendBudgetReminderEmail({
      firstName: 'Justin', email: 'test@example.com', monthName: 'October', daysRemaining: 16,
      ...section('QAR', '﷼'),
      otherCurrencies: [section('PHP', '₱')],
    })
    expect(sent).toHaveLength(1)
    const { html } = sent[0]
    expect(html).toContain('>QAR</p>')
    expect(html).toContain('>PHP</p>')
    expect(html).toContain('₱250.00')
    expect(html).toContain('﷼250.00')
    expect(html.indexOf('>QAR</p>')).toBeLessThan(html.indexOf('>PHP</p>'))
    expect(html).not.toContain("You've used")
  })

  it('monthly report: one email, one section per currency', async () => {
    const report = (currency: string, sym: string) => ({
      currency,
      totalIncome: `${sym}1,000.00`, totalSpent: `${sym}600.00`, totalSaved: `${sym}400.00`,
      categoriesOnBudget: 1, totalCategories: 1,
      topCategories: [{ name: 'Shopping', txnCount: 2, totalSpent: `${sym}600.00`, dotColor: '#f97316' }],
      insight: { comparedCategory: 'Shopping', changePercent: 0, changeDirection: 'increased' as const, comparedMonth: 'August', monthlySavingsFree: `${sym}0.00` },
    })
    await sendMonthlyReportEmail({
      firstName: 'Justin', email: 'test@example.com', monthName: 'September', year: '2026', nextMonthName: 'October',
      ...report('QAR', '﷼'),
      otherCurrencies: [report('PHP', '₱')],
    })
    expect(sent).toHaveLength(1)
    const { html } = sent[0]
    expect(html).toContain('In QAR, you stayed within budget on 1 of 1 categories and saved ﷼400.00.')
    expect(html).toContain('In PHP, you stayed within budget on 1 of 1 categories and saved ₱400.00.')
  })
})
