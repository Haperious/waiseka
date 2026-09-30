import nodemailer, { type Transporter } from 'nodemailer'
import { APP_URL } from '@/lib/app-url'

const CONTACT_EMAIL = 'waise.ka.official@gmail.com'

// ─── Transport ────────────────────────────────────────────────────────────────

// Singleton transporter - reused across all sends in the same process lifetime.
// Nodemailer transporters maintain an SMTP connection pool, so creating one per
// send wastes connections and TCP handshakes.
let _transporter: Transporter | null = null

export function getMailTransporter(): Transporter {
  if (_transporter) return _transporter
  const port = parseInt(process.env.SMTP_PORT ?? '587')
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return _transporter
}

async function sendMail(to: string, subject: string, html: string) {
  await getMailTransporter().sendMail({
    from: process.env.EMAIL_FROM ?? 'Waiseka <noreply@waiseka.app>',
    to,
    subject,
    html,
  })
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
// Light theme, flattened to solid hex - email clients don't support CSS
// variables or reliable rgba. Mirrors the app's sage tokens.

const C = {
  pageBg: '#F7F6F0',
  card: '#FAFAF5',
  elevated: '#F0EDE4',
  hairline: '#E8E8E3',
  header: '#111C14',
  primary: '#166534',
  accent: '#16A34A',
  sage: '#E3EBE2',
  text: '#1A1A17',
  body: '#5A6350',
  muted: '#A3A39F',
  income: '#166534',
  incomeTint: '#E6EDE4',
  expense: '#B91C1C',
  expenseTint: '#F4E6E1',
  warning: '#B45309',
  warningTint: '#F4EBE0',
  headerTag: '#9EC4A6',
  headerTagAlert: '#F87171',
  wordmark: '#ECF4EE',
}

const SANS = `'Geist',-apple-system,'Segoe UI',Arial,sans-serif`
const SERIF = `'Playfair Display',Georgia,serif`
const MONO = `'DM Mono',ui-monospace,Menlo,Consolas,monospace`
const TNUM = 'font-variant-numeric:tabular-nums'

type Tone = 'accent' | 'warning' | 'expense'
type Icon = 'arrow-left-right' | 'pie-chart' | 'target' | 'lightbulb' | 'shield' | 'trending-up'

const TONE_TINT: Record<Tone, string> = { accent: C.sage, warning: C.warningTint, expense: C.expenseTint }

// Escape user-supplied text (names, merchants, goal titles) before it lands in markup.
function esc(s: string | number) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Shared Shell ─────────────────────────────────────────────────────────────

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,900;1,900&family=DM+Mono:wght@400;500&display=swap');
  body{margin:0;padding:0;background:${C.pageBg};-webkit-text-size-adjust:100%}
  a{color:${C.accent}}
  @media only screen and (max-width:600px){
    .wk-outer{padding:16px 0 !important}
    .wk-px{padding-left:16px !important;padding-right:16px !important}
    .wk-h1{font-size:26px !important}
    .wk-stats td.wk-stat{display:block !important;width:auto !important;margin-bottom:8px !important}
    .wk-stats td.wk-gap{display:none !important}
    .wk-cta{width:100% !important}
    .wk-cta td{display:block !important;padding:0 !important}
    .wk-cta td.wk-cap{padding-top:10px !important}
    .wk-btn{display:block !important;text-align:center !important}
  }
`

interface ShellOptions {
  title: string
  tag?: string
  tagAlert?: boolean
  hero: string
  body: string[]
  footerLinks: Array<{ href: string; label: string }>
  footerNote: string
}

function emailHeader(tag?: string, tagAlert = false) {
  const tagHtml = tag
    ? `<td align="right" style="font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${tagAlert ? C.headerTagAlert : C.headerTag}">${tag}</td>`
    : ''
  return `<tr><td class="wk-px" style="background:${C.header};padding:16px 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="width:28px;padding-right:10px"><img src="${APP_URL}/brand/wk-icon-dark.png" width="28" height="28" alt="WaiseKa" style="display:block;border:0;border-radius:7px"></td>
      <td style="font-family:${SANS};font-size:16px;font-weight:800;letter-spacing:-0.02em;color:${C.wordmark}">WaiseKa</td>
      ${tagHtml}
    </tr></table>
  </td></tr>`
}

function emailFooter(links: Array<{ href: string; label: string }>, note: string) {
  const linksHtml = links.length
    ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:12px;font-weight:600">${links.map((l) => `<a href="${l.href}" style="color:${C.accent};text-decoration:none;margin-right:16px">${l.label}</a>`).join('')}</p>`
    : ''
  return `<tr><td class="wk-px" style="background:${C.pageBg};border-top:1px solid ${C.hairline};padding:20px 36px">
    ${linksHtml}
    <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:${C.muted}">${note}<br>WaiseKa · waiseka.app</p>
  </td></tr>`
}

function shell(o: ShellOptions) {
  const blocks = o.body.filter(Boolean).map((b, i) => `<div style="${i ? 'margin-top:22px' : ''}">${b}</div>`).join('')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light"><title>${o.title}</title><style>${BASE_CSS}</style></head>
<body style="margin:0;padding:0;background:${C.pageBg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pageBg}"><tr>
<td class="wk-outer" align="center" style="padding:28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${C.card};border:1px solid ${C.hairline};border-radius:16px;overflow:hidden;border-collapse:separate">
    ${emailHeader(o.tag, o.tagAlert)}
    <tr><td class="wk-px" style="padding:36px 36px 4px">${o.hero}</td></tr>
    <tr><td class="wk-px" style="padding:20px 36px 32px">${blocks}</td></tr>
    ${emailFooter(o.footerLinks, o.footerNote)}
  </table>
</td></tr></table>
</body></html>`
}

// ─── Components ───────────────────────────────────────────────────────────────

// Left-aligned hero: eyebrow + Playfair h1 with the second clause in italic.
function hero(eyebrow: string, lead: string, em: string, tone: 'accent' | 'expense' = 'accent') {
  const color = tone === 'expense' ? C.expense : C.accent
  return `<p style="margin:0 0 10px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${color}">${eyebrow}</p>
  <h1 class="wk-h1" style="margin:0;font-family:${SERIF};font-weight:900;font-size:32px;line-height:1.1;letter-spacing:-0.02em;color:${C.text}">${lead} <em style="font-style:italic;color:${color}">${em}</em></h1>`
}

function p(html: string) {
  return `<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.7;color:${C.body}">${html}</p>`
}

function sectionLabel(text: string) {
  return `<p style="margin:0 0 10px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted}">${text}</p>`
}

function iconImg(icon: Icon, tone: Tone, size = 15) {
  return `<img src="${APP_URL}/email-icons/${icon}-${tone}.png" width="${size}" height="${size}" alt="" style="display:block;border:0;margin:0 auto">`
}

function iconChip(icon: Icon, tone: Tone, size = 30, bg: string = TONE_TINT[tone]) {
  const radius = size >= 34 ? 10 : 9
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" style="width:${size}px;height:${size}px;background:${bg};border-radius:${radius}px">${iconImg(icon, tone, size >= 34 ? 17 : 15)}</td></tr></table>`
}

// Primary CTA (one per email) with a muted caption beside it.
function cta(href: string, label: string, caption?: string) {
  const btn = `<a class="wk-btn" href="${href}" style="display:inline-block;background-color:${C.primary};background-image:linear-gradient(135deg,${C.primary},${C.accent});color:#FFFFFF;font-family:${SANS};font-size:14px;font-weight:700;padding:13px 26px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(22,163,74,0.35)">${label}</a>`
  const cap = caption
    ? `<td class="wk-cap" style="padding-left:14px;font-family:${SANS};font-size:12px;color:${C.muted}">${caption}</td>`
    : ''
  return `<table class="wk-cta" role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>${btn}</td>${cap}</tr></table>`
}

function secondaryButton(href: string, label: string) {
  return `<a class="wk-btn" href="${href}" style="display:inline-block;background:${C.primary};color:#FFFFFF;font-family:${SANS};font-size:14px;font-weight:700;padding:11px 22px;border-radius:8px;text-decoration:none">${label}</a>`
}

interface StatCard { label: string; value: string; color: string; bg?: string }

// Three cards across, 10px apart, each with a 3px semantic stripe. Tables for Outlook.
function stats(cards: StatCard[]) {
  const cells = cards.map((c, i) => `${i ? '<td class="wk-gap" style="width:10px;font-size:0">&nbsp;</td>' : ''}
      <td class="wk-stat" valign="top" style="width:${Math.floor(100 / cards.length)}%;background:${c.bg ?? C.pageBg};border:1px solid ${C.hairline};border-left:3px solid ${c.color};border-radius:14px;padding:13px 14px">
        <div style="font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};margin-bottom:4px">${c.label}</div>
        <div style="font-family:${SANS};font-size:20px;font-weight:800;${TNUM};color:${c.color}">${c.value}</div>
      </td>`).join('')
  return `<table class="wk-stats" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>${cells}</tr></table>`
}

// Tinted callout with an icon chip and a strong lead-in.
function callout(tone: Tone, icon: Icon, html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${TONE_TINT[tone]};border-radius:10px;border-collapse:separate"><tr>
    <td valign="top" style="width:30px;padding:14px 12px 14px 16px">${iconChip(icon, tone, 30, C.card)}</td>
    <td valign="middle" style="padding:14px 16px 14px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.text}">${html}</td>
  </tr></table>`
}

// Bordered list: optional header row, then rows separated by hairlines.
function listBox(rows: string[], header?: string) {
  const head = header
    ? `<tr><td style="background:${C.elevated};padding:10px 16px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted}">${header}</td></tr>`
    : ''
  const body = rows.map((r, i) => `<tr><td style="padding:13px 16px;${i || header ? `border-top:1px solid ${C.hairline}` : ''}">${r}</td></tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.hairline};border-radius:14px;border-collapse:separate;overflow:hidden">${head}${body}</table>`
}

function pctColor(pct: number) {
  if (pct >= 100) return C.expense
  if (pct >= 75) return C.warning
  return C.accent
}

function bar(pct: number, fill: string, track: string = C.elevated) {
  const w = Math.max(0, Math.min(pct, 100))
  const fillCell = w > 0 ? `<td style="width:${w}%;background:${fill};height:8px;border-radius:999px;font-size:0;line-height:0">&nbsp;</td>` : ''
  const rest = w < 100 ? `<td style="font-size:0;line-height:0">&nbsp;</td>` : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${track};border-radius:999px;height:8px;border-collapse:separate"><tr>${fillCell}${rest}</tr></table>`
}

function progressRow(name: string, right: string, pct: number, color: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:7px"><tr>
      <td style="font-family:${SANS};font-size:13px;font-weight:600;color:${C.text}">${name}</td>
      <td align="right" style="font-family:${SANS};font-size:13px;font-weight:700;${TNUM};color:${color};white-space:nowrap">${right}</td>
    </tr></table>
    ${bar(pct, color)}`
}

// Category dot colours for the monthly report; unknown categories cycle the palette.
const DOT_PALETTE = [C.expense, C.warning, C.income, C.body]
const CATEGORY_DOT: Record<string, string> = {
  'Housing': C.expense, 'Food & Dining': C.warning, 'Padala': C.income, 'Transportation': C.body,
}

// ─── 1. Welcome (1a) ──────────────────────────────────────────────────────────

export interface WelcomeEmailData {
  firstName: string
  email: string
}

export async function sendWelcomeEmail(data: WelcomeEmailData) {
  const settingsUrl = `${APP_URL}/settings`
  const steps: Array<{ icon: Icon; title: string; line: string }> = [
    { icon: 'arrow-left-right', title: 'Log a transaction', line: 'Add what you spent or earned today. It takes seconds.' },
    { icon: 'pie-chart', title: 'Set a monthly budget', line: 'Give each category a limit so you always know where you stand.' },
    { icon: 'target', title: 'Create a savings goal', line: 'Travel fund, emergency buffer or a big purchase. Progress tracks itself.' },
    { icon: 'trending-up', title: 'Read your monthly report', line: 'On the 1st of every month you get a full breakdown of your income, spending and savings.' },
  ]
  const checklist = listBox(steps.map((s) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="top" style="width:30px;padding-right:14px">${iconChip(s.icon, 'accent')}</td>
      <td valign="top">
        <div style="font-family:${SANS};font-size:14px;font-weight:700;color:${C.text};margin-bottom:2px">${s.title}</div>
        <div style="font-family:${SANS};font-size:13px;line-height:1.5;color:${C.body}">${s.line}</div>
      </td>
    </tr></table>`))

  const html = shell({
    title: 'Welcome to WaiseKa',
    hero: hero(`Welcome, ${esc(data.firstName)}`, 'Every peso,', 'finally accounted for.'),
    body: [
      p('Your WaiseKa account is ready. Four quick steps get you the most out of it:'),
      checklist,
      cta(`${APP_URL}/budgets`, 'Set up my budget', 'Takes about 3 minutes'),
    ],
    footerLinks: [
      { href: settingsUrl, label: 'Help center' },
      { href: settingsUrl, label: 'Privacy policy' },
      { href: settingsUrl, label: 'Manage notifications' },
    ],
    footerNote: "You're receiving this because you just created a WaiseKa account.",
  })
  await sendMail(data.email, `Welcome to WaiseKa, ${data.firstName}!`, html)
}

// ─── 2. Reset Password (1c) ───────────────────────────────────────────────────

export interface ResetPasswordEmailData {
  firstName: string
  email: string
  resetUrl: string
  expiryMinutes: number
  requestedAt: string
  deviceInfo: string
  locationApprox: string
}

export async function sendResetPasswordEmail(data: ResetPasswordEmailData) {
  const settingsUrl = `${APP_URL}/settings`
  // Request details only show rows that carry real data.
  const details = [
    { k: 'Requested', v: data.requestedAt },
    { k: 'Device', v: data.deviceInfo },
    { k: 'Location', v: data.locationApprox === 'Location unavailable' ? '' : data.locationApprox },
  ].filter((d) => d.v)
  const detailsTable = details.length ? listBox(details.map((d) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="width:96px;font-family:${SANS};font-size:12px;font-weight:600;color:${C.muted}">${d.k}</td>
      <td style="font-family:${MONO};font-size:12px;color:${C.text}">${esc(d.v)}</td>
    </tr></table>`), 'Request details') : ''

  const html = shell({
    title: 'Reset your WaiseKa password',
    tag: 'Security',
    hero: hero('Password reset', 'Reset your password', 'in one click.'),
    body: [
      p(`Hi ${esc(data.firstName)}, someone asked to reset the password on your WaiseKa account. The link below works once and expires in <strong style="color:${C.text}">${data.expiryMinutes} minutes</strong>.`),
      cta(data.resetUrl, 'Reset my password', `Expires in ${data.expiryMinutes} minutes`),
      detailsTable,
      callout('accent', 'shield', `<strong>Didn't ask for this?</strong> Ignore this email. Your password stays the same unless you use the link above. WaiseKa never asks for your password by email, chat or phone.`),
    ],
    footerLinks: [
      { href: settingsUrl, label: 'Help center' },
      { href: settingsUrl, label: 'Report an issue' },
    ],
    footerNote: "Automated security email. Please don't reply.",
  })
  await sendMail(data.email, 'Reset your WaiseKa password', html)
}

// ─── 3. Budget Reminder (1d) ──────────────────────────────────────────────────

export interface BudgetReminderCategory {
  name: string
  usedPercent: number
  spent: string
  limit: string
}

export interface BudgetReminderEmailData {
  firstName: string
  email: string
  monthName: string
  daysRemaining: number
  usedPercent: number
  totalIncome: string
  totalSpent: string
  totalRemaining: string
  categories: BudgetReminderCategory[]
  alertCategory?: string
  projectedOverage?: string
}

export async function sendBudgetReminderEmail(data: BudgetReminderEmailData) {
  const settingsUrl = `${APP_URL}/settings`
  const categoryRows = data.categories.map((c, i) =>
    `<div style="${i ? 'margin-top:14px' : ''}">${progressRow(esc(c.name), `${c.spent} / ${c.limit} · ${c.usedPercent}%`, c.usedPercent, pctColor(c.usedPercent))}</div>`,
  ).join('')

  const html = shell({
    title: `Your ${data.monthName} budget check-in`,
    tag: 'Budget check-in',
    hero: hero(`${data.monthName} · ${data.daysRemaining} days left`, `You've used ${data.usedPercent}% of`, `your ${data.monthName} budget.`),
    body: [
      p(`Hi ${esc(data.firstName)}, here's where your money stands with ${data.daysRemaining} days to go.`),
      stats([
        { label: 'Income', value: data.totalIncome, color: C.income },
        { label: 'Spent', value: data.totalSpent, color: C.expense },
        { label: 'Remaining', value: data.totalRemaining, color: C.accent },
      ]),
      data.categories.length ? sectionLabel('By category') + categoryRows : '',
      data.alertCategory && data.projectedOverage
        ? callout('warning', 'trending-up', `<strong>Heads up:</strong> at your current pace, ${esc(data.alertCategory)} will go over its limit by about ${data.projectedOverage} before month-end.`)
        : '',
      cta(`${APP_URL}/budgets`, 'View my budget', "Log today's expenses while you're there"),
    ],
    footerLinks: [
      { href: settingsUrl, label: 'Manage alerts' },
      { href: settingsUrl, label: 'Unsubscribe' },
    ],
    footerNote: "You're receiving this as part of your monthly budget check-in.",
  })
  await sendMail(data.email, `Your ${data.monthName} budget check-in`, html)
}

// ─── 4. Re-Engage (1h) ────────────────────────────────────────────────────────

export interface ReEngageEmailData {
  firstName: string
  email: string
  daysSinceLogin: number
  monthName: string
  daysRemaining: number
  topGoalName: string
  topGoalPercent: number
  topGoalTarget: string
}

export async function sendReEngageEmail(data: ReEngageEmailData) {
  const settingsUrl = `${APP_URL}/settings`
  const goalCard = listBox([`${progressRow(esc(data.topGoalName), `${data.topGoalPercent}%`, data.topGoalPercent, C.income)}
    <p style="margin:10px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.body}">You're ${data.topGoalPercent}% of the way to your ${data.topGoalTarget} target. A quick check-in keeps the momentum going.</p>`])

  const html = shell({
    title: `It's been a while, ${esc(data.firstName)}`,
    hero: hero(`${data.daysSinceLogin} days since your last visit`, "It's been a while,", `${esc(data.firstName)}.`),
    body: [
      p('Two minutes of logging is enough to catch up. Here\'s where things stand:'),
      stats([
        { label: 'Days unlogged', value: String(data.daysSinceLogin), color: C.warning },
        { label: `Days left`, value: String(data.daysRemaining), color: C.text },
        { label: 'Goal progress', value: `${data.topGoalPercent}%`, color: C.income },
      ]),
      goalCard,
      cta(`${APP_URL}/dashboard`, 'Open WaiseKa', 'Pick up where you left off'),
    ],
    footerLinks: [
      { href: settingsUrl, label: 'Manage notifications' },
      { href: settingsUrl, label: 'Unsubscribe' },
    ],
    footerNote: `You're receiving this because you haven't logged in for ${data.daysSinceLogin} days.`,
  })
  await sendMail(data.email, `It's been a while, ${data.firstName}`, html)
}

// ─── 5. Monthly Report (1f) ───────────────────────────────────────────────────

export interface MonthlyReportCategory {
  name: string
  txnCount: number
  totalSpent: string
  dotColor: string
}

export interface MonthlyReportInsight {
  comparedCategory: string
  changePercent: number
  changeDirection: 'dropped' | 'increased'
  comparedMonth: string
  monthlySavingsFree: string
}

export interface MonthlyReportEmailData {
  firstName: string
  email: string
  monthName: string
  year: string
  nextMonthName: string
  totalIncome: string
  totalSpent: string
  totalSaved: string
  categoriesOnBudget: number
  totalCategories: number
  topCategories: MonthlyReportCategory[]
  insight: MonthlyReportInsight
}

export async function sendMonthlyReportEmail(data: MonthlyReportEmailData) {
  const settingsUrl = `${APP_URL}/settings`
  const categoryRows = data.topCategories.map((c, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="width:8px;padding-right:12px"><div style="width:8px;height:8px;border-radius:50%;background:${CATEGORY_DOT[c.name] ?? DOT_PALETTE[i % DOT_PALETTE.length]};font-size:0;line-height:0">&nbsp;</div></td>
      <td style="font-family:${SANS};font-size:13px;font-weight:600;color:${C.text}">${esc(c.name)}</td>
      <td style="font-family:${SANS};width:110px;font-size:12px;color:${C.muted};white-space:nowrap;padding:0 12px">${c.txnCount} transaction${c.txnCount === 1 ? '' : 's'}</td>
      <td align="right" style="width:96px;font-family:${SANS};font-size:13px;font-weight:700;${TNUM};color:${C.expense};white-space:nowrap">${c.totalSpent}</td>
    </tr></table>`)

  const budgetLine = data.totalCategories > 0
    ? `you stayed within budget on ${data.categoriesOnBudget} of ${data.totalCategories} categories and saved ${data.totalSaved}`
    : `you saved ${data.totalSaved}`
  const { insight } = data
  const insightFree = insight.changeDirection === 'dropped' && insight.changePercent > 0
    ? ` Keep that up and you free up about ${insight.monthlySavingsFree} a month for savings.`
    : ''

  const html = shell({
    title: `Your ${data.monthName} ${data.year} financial report`,
    tag: 'Monthly report',
    hero: hero(`${data.monthName} ${data.year} report`, 'How was your money', `this ${data.monthName}?`),
    body: [
      p(`Hi ${esc(data.firstName)}, in ${data.monthName} ${budgetLine}. Here's the breakdown.`),
      stats([
        { label: 'Total income', value: data.totalIncome, color: C.income },
        { label: 'Total spent', value: data.totalSpent, color: C.expense },
        { label: 'Saved', value: data.totalSaved, color: C.accent },
      ]),
      categoryRows.length ? sectionLabel('Top spending categories') + listBox(categoryRows, `Highest expenses in ${data.monthName}`) : '',
      callout('accent', 'lightbulb', `<strong>WaiseKa insight:</strong> your ${esc(insight.comparedCategory)} spending ${insight.changeDirection} ${insight.changePercent}% compared with ${insight.comparedMonth}.${insightFree}`),
      cta(`${APP_URL}/reports`, `View my ${data.monthName} report`, `Set your ${data.nextMonthName} budget while you're there`),
    ],
    footerLinks: [
      { href: settingsUrl, label: 'Manage reports' },
      { href: settingsUrl, label: 'Unsubscribe' },
    ],
    footerNote: 'Your monthly report is generated on the 1st of each month.',
  })
  await sendMail(data.email, `Your ${data.monthName} ${data.year} financial report`, html)
}

// ─── 6. Spending Alert (1e) ───────────────────────────────────────────────────

export interface SpendingAlertTransaction {
  merchantName: string
  date: string
  label: string
  amount: string
}

export interface SpendingAlertEmailData {
  firstName: string
  email: string
  categoryName: string
  budgetLimit: string
  totalSpent: string
  overBy: string
  triggerAmount: string
  triggerMerchant: string
  monthName: string
  daysRemaining: number
  recentTxns: SpendingAlertTransaction[]
  surplusCategory: string
  surplusCategoryRemaining: string
}

export async function sendSpendingAlertEmail(data: SpendingAlertEmailData) {
  const settingsUrl = `${APP_URL}/settings`
  const category = esc(data.categoryName)
  const txnRows = data.recentTxns.map((t) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td>
        <div style="font-family:${SANS};font-size:13px;font-weight:600;color:${C.text}">${esc(t.merchantName)}</div>
        <div style="font-family:${SANS};font-size:12px;color:${C.muted};margin-top:2px">${esc(t.date)}${t.label ? ` · ${esc(t.label)}` : ''}</div>
      </td>
      <td align="right" valign="middle" style="width:76px;font-family:${SANS};font-size:13px;font-weight:700;${TNUM};color:${C.expense};white-space:nowrap">-${t.amount}</td>
    </tr></table>`)
  // The caller falls back to a zero amount when no other category has room.
  const hasSurplus = /[1-9]/.test(data.surplusCategoryRemaining)

  const html = shell({
    title: `Budget alert: ${category} limit exceeded`,
    tag: 'Budget alert',
    tagAlert: true,
    hero: hero(`Budget alert · ${category}`, 'You went over', `your ${category} budget.`, 'expense'),
    body: [
      p(`Hi ${esc(data.firstName)}, a ${data.triggerAmount} transaction at ${esc(data.triggerMerchant)} pushed ${category} past its ${data.budgetLimit} limit. You still have ${data.daysRemaining} days left in ${data.monthName}.`),
      stats([
        { label: 'Limit', value: data.budgetLimit, color: C.text },
        { label: 'Spent', value: data.totalSpent, color: C.expense },
        { label: 'Over by', value: data.overBy, color: C.expense, bg: C.expenseTint },
      ]),
      txnRows.length ? sectionLabel(`Recent ${category} transactions`) + listBox(txnRows) : '',
      hasSurplus
        ? callout('accent', 'lightbulb', `<strong>Quick fix:</strong> ${esc(data.surplusCategory)} still has ${data.surplusCategoryRemaining} left. Move some of it over to cover the overage.`)
        : '',
      cta(`${APP_URL}/budgets`, 'Adjust my budget', 'Or re-categorize a transaction'),
    ],
    footerLinks: [
      { href: settingsUrl, label: 'Manage alert settings' },
      { href: settingsUrl, label: 'Unsubscribe' },
    ],
    footerNote: "You're receiving this because budget alerts are on.",
  })
  await sendMail(data.email, `Budget alert: ${data.categoryName} limit exceeded`, html)
}

// ─── 7. Email Verification (1b) ──────────────────────────────────────────────

export async function sendVerificationEmail(data: { firstName: string; email: string; verifyUrl: string }) {
  const fallback = `<div style="background:${C.elevated};border-radius:10px;padding:14px 16px">
    <p style="margin:0 0 4px;font-family:${SANS};font-size:12px;font-weight:700;color:${C.text}">Button not working?</p>
    <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;color:${C.body}">Paste this link into your browser:</p>
    <p style="margin:0;font-family:${MONO};font-size:11px;line-height:1.6;color:${C.accent};word-break:break-all">${esc(data.verifyUrl)}</p>
  </div>`

  const html = shell({
    title: 'Verify your WaiseKa email address',
    tag: 'Security',
    hero: hero('One last step', 'Confirm your email', 'to activate your account.'),
    body: [
      p(`Hi ${esc(data.firstName)}, tap the button below to confirm this is your email address. If you didn't create a WaiseKa account, you can ignore this email.`),
      cta(data.verifyUrl, 'Verify my email', 'Expires in 24 hours'),
      fallback,
    ],
    footerLinks: [{ href: `${APP_URL}/login`, label: 'Back to login' }],
    footerNote: "You're receiving this because you created a WaiseKa account.",
  })
  await sendMail(data.email, 'Verify your WaiseKa email address', html)
}

// ─── 8. Savings Milestone (1g) ────────────────────────────────────────────────

export interface SavingsMilestoneEmailData {
  firstName: string
  email: string
  goalName: string
  reachedPercent: number
  monthsToTarget: number
  targetAmount: string
  savedAmount: string
  monthsSaving: number
  avgPerMonth: string
  estCompletionMonthYear: string
  userRankPercent: number
  nextMilestoneAmount: string
}

export async function sendSavingsMilestoneEmail(data: SavingsMilestoneEmailData) {
  const settingsUrl = `${APP_URL}/settings`
  const goal = esc(data.goalName)
  // The one dark panel in the system - intentionally dark in every client.
  const panel = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.header};background-image:linear-gradient(145deg,#111C14,#162018 55%,#1D2E20);border-radius:16px;border-collapse:separate"><tr><td style="padding:22px 24px">
    <div style="font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${C.headerTag};margin-bottom:6px">Saved so far</div>
    <div style="font-family:${SANS};font-size:34px;font-weight:800;${TNUM};letter-spacing:-0.02em;color:${C.wordmark};line-height:1.1">${data.savedAmount}</div>
    <div style="font-family:${SANS};font-size:12px;color:${C.headerTag};margin:4px 0 16px">of your ${data.targetAmount} ${goal} goal</div>
    ${bar(data.reachedPercent, '#4ADE80', '#1D2E20')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px"><tr>
      <td style="font-family:${SANS};font-size:11px;font-weight:600;color:${C.headerTag}">${data.reachedPercent}% complete</td>
      <td align="right" style="font-family:${SANS};font-size:11px;font-weight:600;${TNUM};color:${C.headerTag}">${data.targetAmount}</td>
    </tr></table>
  </td></tr></table>`

  const html = shell({
    title: `${goal} milestone reached`,
    tag: 'Goals',
    hero: hero('Savings milestone', `You're ${data.reachedPercent}% of the way`, `to ${goal}.`),
    body: [
      p(`Hi ${esc(data.firstName)}, your consistency is paying off. Keep this pace and you'll reach your full ${data.targetAmount} target in about ${data.monthsToTarget} month${data.monthsToTarget === 1 ? '' : 's'}.`),
      panel,
      stats([
        { label: 'Months saving', value: String(data.monthsSaving), color: C.income },
        { label: 'Avg / month', value: data.avgPerMonth, color: C.income },
        { label: 'Next milestone', value: data.nextMilestoneAmount, color: C.accent },
      ]),
      callout('accent', 'lightbulb', `<strong>WaiseKa insight:</strong> saving ${data.avgPerMonth} a month got you here. Your next milestone is ${data.nextMilestoneAmount}.`),
      cta(`${APP_URL}/goals`, 'View my goals', 'Add a new goal or top up this one'),
    ],
    footerLinks: [
      { href: settingsUrl, label: 'Manage goals' },
      { href: settingsUrl, label: 'Unsubscribe' },
    ],
    footerNote: "You're receiving this because milestone notifications are on.",
  })
  await sendMail(data.email, `${data.goalName} milestone reached`, html)
}

// ─── 9. Setup Nudge (Marketing) (1i) ──────────────────────────────────────────
// Sent on the 1st of each month to users who:
//   - registered > 7 days ago
//   - have no budget set, no goals set, or both
//   - have not received this email type in the current calendar month
//
// Dynamic sections: budget step shows if noBudget=true, goal step if noGoals=true.

export interface SetupNudgeEmailData {
  firstName: string
  email: string
  noBudget: boolean
  noGoals: boolean
  monthName: string  // e.g. "July"
}

function stepCard(o: { step: number; stripe: string; icon: Icon; title: string; copy: string; extra?: string; button: string }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pageBg};border:1px solid ${C.hairline};border-left:3px solid ${o.stripe};border-radius:16px;border-collapse:separate"><tr><td style="padding:20px 22px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px"><tr>
      <td valign="middle" style="padding-right:12px">${iconChip(o.icon, 'accent', 34)}</td>
      <td valign="middle">
        <div style="font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${C.accent}">Step ${o.step}</div>
        <div style="font-family:${SANS};font-size:16px;font-weight:700;color:${C.text}">${o.title}</div>
      </td>
    </tr></table>
    <p style="margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:1.7;color:${C.body}">${o.copy}</p>
    ${o.extra ?? ''}
    ${o.button}
  </td></tr></table>`
}

export async function sendSetupNudgeEmail(data: SetupNudgeEmailData) {
  const settingsUrl = `${APP_URL}/settings`
  const both = data.noBudget && data.noGoals

  // Derive subject line based on what's missing
  const subject = both
    ? `${data.firstName}, your WaiseKa account is missing a few things`
    : data.noBudget
      ? `${data.firstName}, you still haven't set a budget`
      : `${data.firstName}, you're halfway there: add a savings goal`

  const heroHtml = both
    ? hero(`${data.monthName} setup`, 'Your account is', 'almost ready.')
    : data.noBudget
      ? hero(`${data.monthName} setup`, 'One step left:', 'set a budget.')
      : hero(`${data.monthName} setup`, "You're close:", 'add a savings goal.')

  const budgetStep = data.noBudget ? stepCard({
    step: 1,
    stripe: C.accent,
    icon: 'pie-chart',
    title: 'Set a monthly budget',
    copy: 'Give each category a limit and WaiseKa warns you before you overspend. People who set even one budget in their first month save 23% more.',
    button: cta(`${APP_URL}/budgets`, 'Set my first budget', 'Takes about 3 minutes'),
  }) : ''

  const goalIdeas = ['Travel fund', 'Emergency fund', 'House down payment', 'Big purchase']
    .map((g) => `<span style="display:inline-block;font-family:${SANS};font-size:12px;font-weight:600;color:${C.text};background:${C.card};border:1px solid ${C.hairline};border-radius:999px;padding:5px 12px;margin:0 6px 8px 0">${g}</span>`)
    .join('')
  const goalStep = data.noGoals ? stepCard({
    step: data.noBudget ? 2 : 1,
    stripe: C.income,
    icon: 'target',
    title: 'Create a savings goal',
    copy: 'Name it, set a target, and your progress tracks itself. Not sure where to start? Try one of these:',
    extra: `<div style="margin-bottom:10px">${goalIdeas}</div>`,
    // One primary CTA per email: the goal button drops to secondary when it's step 2.
    button: data.noBudget
      ? secondaryButton(`${APP_URL}/goals`, 'Create my first goal')
      : cta(`${APP_URL}/goals`, 'Create my first goal', 'Name it, set a target, done'),
  }) : ''

  const html = shell({
    title: 'Complete your WaiseKa setup',
    hero: heroHtml,
    body: [
      p(`Hi ${esc(data.firstName)}, it's the start of ${data.monthName}, a clean slate for your money. ${both ? 'Two quick steps unlock' : 'One quick step unlocks'} the rest of WaiseKa.`),
      budgetStep,
      goalStep,
    ],
    footerLinks: [
      { href: `${APP_URL}/budgets`, label: 'Set a budget' },
      { href: `${APP_URL}/goals`, label: 'Create a goal' },
      { href: settingsUrl, label: 'Unsubscribe' },
    ],
    footerNote: "You're receiving this because your WaiseKa setup isn't complete yet.",
  })

  await sendMail(data.email, subject, html)
}

// ─── 10. Scheduled Function Failure (Admin Alert) (1j) ───────────────────────
// Sent to the WaiseKa inbox (not a user) when the Netlify scheduled-cron
// function fails to run /api/cron - there's no browser involved in that
// failure, so an email is the only way anyone finds out.

export interface CronFailureEmailData {
  reason: string
  detail: string
  occurredAt: string
}

export async function sendCronFailureEmail(data: CronFailureEmailData) {
  const kv = [
    { k: 'Function', v: 'scheduled-cron.mts' },
    { k: 'Reason', v: data.reason },
    { k: 'Occurred', v: data.occurredAt },
  ]
  const kvTable = listBox(kv.map((r) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="width:90px;font-family:${SANS};font-size:12px;font-weight:600;color:${C.muted}">${r.k}</td>
      <td style="font-family:${MONO};font-size:12px;color:${C.text};word-break:break-word">${esc(r.v)}</td>
    </tr></table>`))
  // Internal alert: Geist heading instead of the Playfair hero.
  const heroHtml = `<p style="margin:0 0 10px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${C.expense}">Scheduled cron failure</p>
  <h1 style="margin:0;font-family:${SANS};font-size:22px;font-weight:800;line-height:1.25;letter-spacing:-0.02em;color:${C.text}">${esc(data.reason.replace(' responded ', ' returned '))}</h1>`

  const html = shell({
    title: 'WaiseKa scheduled cron failure',
    tag: 'Ops',
    tagAlert: true,
    hero: heroHtml,
    body: [
      p('The hourly Netlify scheduled function could not complete /api/cron. Check the scheduled-cron function logs in Netlify for full context.'),
      kvTable,
      `<pre style="margin:0;background:#0C100E;border-radius:10px;padding:14px 16px;font-family:${MONO};font-size:11.5px;line-height:1.6;color:#F87171;white-space:pre-wrap;word-break:break-word">${esc(data.detail)}</pre>`,
    ],
    footerLinks: [],
    footerNote: 'Automated alert from scheduled-cron.mts.',
  })
  await sendMail(CONTACT_EMAIL, `[WaiseKa] Scheduled cron failure - ${data.reason}`, html)
}
