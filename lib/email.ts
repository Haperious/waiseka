import nodemailer from 'nodemailer'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

// ─── Transport ────────────────────────────────────────────────────────────────

// Singleton transporter — reused across all sends in the same process lifetime.
// Nodemailer transporters maintain an SMTP connection pool, so creating one per
// send wastes connections and TCP handshakes.
let _transporter: nodemailer.Transporter | null = null

export function getMailTransporter(): nodemailer.Transporter {
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

// ─── Shared Partials ──────────────────────────────────────────────────────────

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Sora',sans-serif;background:#DFF0E4;padding:2rem 1rem;color:#0D3D1F}
  .wrap{max-width:600px;margin:0 auto}
  .shell{background:#F4FBF6;border-radius:18px;overflow:hidden;border:1px solid #C8E3C4}
  .mhead{background:#1A6B3A;padding:24px 40px;display:flex;align-items:center;gap:10px}
  .mbrand{font-size:17px;font-weight:700;color:#fff;letter-spacing:-0.01em}
  .mbrand span{color:#C2EDD0}
  .hero{background:#FFFFFF;padding:36px 44px 32px;text-align:center;border-bottom:1px solid #C8E3C4}
  .hico{width:68px;height:68px;border-radius:18px;background:#EEF9F3;border:1px solid #C8E3C4;display:block;text-align:center;line-height:68px;margin:0 auto 18px;font-size:28px}
  .h1{font-size:22px;font-weight:700;color:#0D3D1F;margin-bottom:8px;line-height:1.25;letter-spacing:-0.02em}
  .hsub{font-size:13px;color:#1A6B3A;line-height:1.65;max-width:370px;margin:0 auto}
  .body{background:#FFFFFF;padding:28px 44px}
  .gr{font-size:13px;font-weight:700;color:#1A6B3A;margin-bottom:10px}
  .p{font-size:13px;color:#2D4A35;line-height:1.8;margin-bottom:14px}
  .cta{text-align:center;padding:6px 0 22px}
  .btn{display:inline-block;background:#1A6B3A;color:#fff !important;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;padding:13px 34px;border-radius:100px;text-decoration:none !important;letter-spacing:0.01em}
  .btnsub{font-size:10px;color:#2A9654;margin-top:8px;font-family:'DM Mono',monospace}
  .hr{border:none;border-top:1px solid #C8E3C4;margin:0 44px}
  .tip{background:#EEF9F3;border-left:3px solid #3BAF68;border-radius:0 10px 10px 0;padding:13px 16px;margin:20px 44px;font-size:12px;color:#0D3D1F;line-height:1.65}
  .tip b{color:#1A6B3A}
  .foot{background:#EEF9F3;padding:20px 44px;text-align:center;border-top:1px solid #C8E3C4}
  .fbrand{font-size:11px;font-weight:700;color:#1A6B3A;margin-bottom:5px}
  .flinks{display:flex;justify-content:center;gap:14px;margin-bottom:10px;flex-wrap:wrap}
  .fl{font-size:10px;color:#2A9654;text-decoration:none}
  .ftxt{font-size:10px;color:#7A9A80;line-height:1.65;font-family:'DM Mono',monospace}
  @media only screen and (max-width:600px){
    .body{padding:20px 16px !important}
    .hero{padding:28px 16px 24px !important}
    .mhead{padding:18px 16px !important}
    .foot{padding:18px 16px !important}
    .hr{margin:0 16px !important}
    .tip{margin:16px !important}
    .sect-lbl{padding:0 16px !important}
    .progs{margin:0 16px 16px !important}
    .txns,.secinfo,.alert-sec,.insight-alert,.alert-dng,.budget-alert,.goal-alert,.milestone{margin-left:16px !important;margin-right:16px !important}
    .mbrand{font-size:15px !important}
    .h1{font-size:18px !important}
    .btn{display:block !important;text-align:center !important}
    table.stats{width:calc(100% - 32px) !important;margin:0 16px 16px !important}
    table.stats td{display:block !important;width:100% !important;margin-bottom:8px !important}
  }
`

function emailHeader() {
  return `<div class="mhead"><img src="${APP_URL}/logo.png" width="32" height="32" alt="WaiseKa" style="border-radius:9px;display:block;flex-shrink:0"><span class="mbrand">Waise<span>Ka</span></span></div>`
}

function emailFooter(links: Array<{ href: string; label: string }>, note: string, brand = 'WaiseKa') {
  const linksHtml = links.map((l) => `<a href="${l.href}" class="fl">${l.label}</a>`).join('\n      ')
  return `
  <div class="foot">
    <p class="fbrand">${brand}</p>
    <div class="flinks">${linksHtml}</div>
    <p class="ftxt">${note}</p>
  </div>`
}

function statsTable(cards: Array<{ emoji: string; label: string; value: string; color: string }>) {
  const cellHtml = cards.map((c) => `
      <td style="background:#FAFFFE;border:1px solid #C8E3C4;border-radius:12px;padding:14px 10px;text-align:center;width:33%">
        <div style="font-size:18px;margin-bottom:6px">${c.emoji}</div>
        <div style="font-size:10px;font-weight:700;color:#1A6B3A;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:3px">${c.label}</div>
        <div style="font-family:'DM Mono',monospace;font-size:14px;font-weight:500;color:${c.color}">${c.value}</div>
      </td>`).join('')
  return `<table class="stats" style="display:table;width:calc(100% - 88px);margin:0 44px 20px;border-collapse:separate;border-spacing:10px 0"><tr>${cellHtml}</tr></table>`
}

function barClass(pct: number) {
  if (pct >= 100) return 'pf d'
  if (pct >= 75) return 'pf w'
  return 'pf'
}

function pctColor(pct: number) {
  if (pct >= 100) return '#C0392B'
  if (pct >= 75) return '#D4950A'
  return '#2A9654'
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Food & Dining': '🍜', 'Transportation': '🚗', 'Housing': '🏠',
  'Entertainment': '🎬', 'Health & Fitness': '💪', 'Shopping': '🛍️',
  'Utilities': '💡', 'Education': '📚', 'Travel': '✈️',
  'Personal Care': '🪴', 'Gifts & Donations': '🎁', 'Business': '💼',
  'Salary': '💰', 'Freelance': '💻', 'Investment': '📈',
  'Business Income': '🏢', 'Other': '📦',
}
const categoryEmoji = (name: string) => CATEGORY_EMOJI[name] ?? '📊'

// ─── 1. Welcome ───────────────────────────────────────────────────────────────

export interface WelcomeEmailData {
  firstName: string
  email: string
}

export async function sendWelcomeEmail(data: WelcomeEmailData) {
  const settingsUrl = `${APP_URL}/settings`
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Welcome to WaiseKa!</title><style>${BASE_CSS}
  .fi{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #C8E3C4}
  .fi:last-child{border-bottom:none}
  .fchk{width:20px;height:20px;border-radius:50%;background:#EEF9F3;border:1px solid #C8E3C4;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;font-size:11px;color:#2A9654}
  .ft{font-size:13px;color:#0D3D1F;line-height:1.55}
  .ft b{color:#1A6B3A}
</style></head><body>
<div class="wrap"><div class="shell">
  ${emailHeader()}
  <div class="hero">
    <div class="hico">🌱</div>
    <h1 class="h1">Welcome to WaiseKa, ${data.firstName}!</h1>
    <p class="hsub">Your smart money companion is ready. Let's build habits that actually stick.</p>
  </div>
  <div class="body">
    <p class="gr">Hey ${data.firstName},</p>
    <p class="p">You've just taken a meaningful first step toward financial clarity. WaiseKa is here to help you track spending, crush your savings goals, and finally understand where every peso goes - all in one place.</p>
    <p class="p">Here's how to hit the ground running:</p>
  </div>
  <div style="margin:0 44px 20px">
    <div class="fi"><div class="fchk">✓</div><div class="ft"><b>Log your first transaction</b> - manual entry or connect your account to get started instantly.</div></div>
    <div class="fi"><div class="fchk">✓</div><div class="ft"><b>Set a monthly budget</b> - define limits per category so you always know where you stand.</div></div>
    <div class="fi"><div class="fchk">✓</div><div class="ft"><b>Create a savings goal</b> - travel fund, emergency buffer, or big purchase - we track your progress.</div></div>
    <div class="fi"><div class="fchk">✓</div><div class="ft"><b>Get monthly insights</b> - WaiseKa surfaces patterns and tips tailored to your habits.</div></div>
  </div>
  <div class="cta">
    <a href="${APP_URL}/budgets" class="btn">Set up my budget</a>
    <p class="btnsub">Takes less than 3 minutes</p>
  </div>
  <div class="hr"></div>
  <div class="tip"><b>WaiseKa tip:</b> Users who set up at least one budget category in their first week save an average of 23% more than those who skip this step.</div>
  ${emailFooter([
    { href: `${APP_URL}/settings`, label: 'Help center' },
    { href: `${APP_URL}/settings`, label: 'Privacy policy' },
    { href: settingsUrl, label: 'Manage notifications' },
  ], "WaiseKa · Smarter money, every day.<br>You're receiving this because you just created an account.")}
</div></div></body></html>`
  await sendMail(data.email, `Welcome to WaiseKa, ${data.firstName}!`, html)
}

// ─── 2. Reset Password ────────────────────────────────────────────────────────

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
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WaiseKa - Reset Your Password</title><style>${BASE_CSS}
  .secinfo{margin:20px 44px;background:#EEF9F3;border-radius:12px;padding:14px 18px}
  .sr{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;color:#0D3D1F;border-bottom:1px solid #C8E3C4}
  .sr:last-child{border-bottom:none}
  .sk{font-weight:700;min-width:96px;color:#1A6B3A;font-size:11px}
  .alert-sec{margin:16px 44px;border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.65;color:#0D3D1F;background:#EEF9F3;border:1px solid #C8E3C4}
  .muted{font-size:12px;color:#5A7A60;line-height:1.8}
</style></head><body>
<div class="wrap"><div class="shell">
  ${emailHeader()}
  <div class="hero">
    <div class="hico">🔐</div>
    <h1 class="h1">Password reset request</h1>
    <p class="hsub">We received a request to reset the password on your WaiseKa account.</p>
  </div>
  <div class="body">
    <p class="gr">Hey ${data.firstName},</p>
    <p class="p">Someone (hopefully you!) asked to reset the password for your WaiseKa account. Click the button below to create a new one. This link is valid for <b>${data.expiryMinutes} minutes</b> and can only be used once.</p>
  </div>
  <div class="cta">
    <a href="${data.resetUrl}" class="btn">Reset my password</a>
    <p class="btnsub">Expires in ${data.expiryMinutes} min · Never share this link with anyone</p>
  </div>
  <div class="hr"></div>
  <div class="secinfo">
    <div class="sr"><span class="sk">Request time</span><span>${data.requestedAt}</span></div>
    <div class="sr"><span class="sk">Device</span><span>${data.deviceInfo}</span></div>
    <div class="sr"><span class="sk">Location</span><span>${data.locationApprox}</span></div>
  </div>
  <div class="body" style="padding-top:0;padding-bottom:16px">
    <p class="muted">Didn't request this? Your account is still safe - just ignore this email. Your password won't change unless you use the link above.</p>
  </div>
  <div class="alert-sec" style="margin:16px 44px">
    <span style="font-size:18px;flex-shrink:0;margin-top:1px">🛡️</span>
    <div><b>Security reminder:</b> WaiseKa will never ask for your password via email, chat, or phone. Always access your account directly at ${APP_URL}.</div>
  </div>
  <div style="height:16px"></div>
  ${emailFooter([
    { href: `${APP_URL}/settings`, label: 'Help center' },
    { href: `${APP_URL}/settings`, label: 'Report an issue' },
  ], 'This is an automated security email. Do not reply.<br>WaiseKa · waiseKa.app', 'WaiseKa Security')}
</div></div></body></html>`
  await sendMail(data.email, 'Reset your WaiseKa password', html)
}

// ─── 3. Budget Reminder ───────────────────────────────────────────────────────

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
  const categoryRows = data.categories.map((c) => {
    const pct = Math.min(c.usedPercent, 100)
    return `
    <div class="pr">
      <div class="prow">
        <span class="pname">${categoryEmoji(c.name)} ${c.name}</span>
        <span class="ppct" style="color:${pctColor(c.usedPercent)}">${c.usedPercent}% · ${c.spent} / ${c.limit}</span>
      </div>
      <div class="pbg"><div class="${barClass(c.usedPercent)}" style="width:${pct}%"></div></div>
    </div>`
  }).join('')

  const alertBlock = data.alertCategory && data.projectedOverage ? `
  <div class="budget-alert">
    <span class="aico">⚠️</span>
    <div><b>Heads up:</b> At your current ${data.alertCategory} spend rate, you'll exceed that budget by about ${data.projectedOverage} before month-end. Consider pulling back for the next few days.</div>
  </div>` : ''

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WaiseKa - Your ${data.monthName} Budget Check-In</title><style>${BASE_CSS}
  .sect-lbl{font-size:10px;font-weight:700;color:#1A6B3A;letter-spacing:0.08em;text-transform:uppercase;padding:0 44px;margin-bottom:10px}
  .progs{margin:0 44px 20px}
  .pr{margin-bottom:10px}
  .pr:last-child{margin-bottom:0}
  .prow{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
  .pname{font-size:12px;font-weight:600;color:#0D3D1F}
  .ppct{font-family:'DM Mono',monospace;font-size:11px}
  .pbg{background:#C8E3C4;border-radius:100px;height:7px;overflow:hidden}
  .pf{height:7px;border-radius:100px;background:#2A9654}
  .pf.w{background:#D4950A}
  .pf.d{background:#C0392B}
  .budget-alert{margin:0 44px 20px;border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.65;color:#0D3D1F;background:#FEF6E4;border:1px solid #F0D078}
  .aico{font-size:18px;flex-shrink:0;margin-top:1px}
</style></head><body>
<div class="wrap"><div class="shell">
  ${emailHeader()}
  <div class="hero">
    <div class="hico">📊</div>
    <h1 class="h1">You're ${data.usedPercent}% through your ${data.monthName} budget</h1>
    <p class="hsub">${data.daysRemaining} days left this month. Here's where things stand.</p>
  </div>
  <div class="body">
    <p class="gr">Hey ${data.firstName},</p>
    <p class="p">Here's your mid-month budget check-in. A couple of categories may need your attention before month-end:</p>
  </div>
  ${statsTable([
    { emoji: '💰', label: 'Income', value: data.totalIncome, color: '#2A9654' },
    { emoji: '💸', label: 'Spent', value: data.totalSpent, color: '#C0392B' },
    { emoji: '🏦', label: 'Remaining', value: data.totalRemaining, color: '#1A6B3A' },
  ])}
  <p class="sect-lbl">Budget by category</p>
  <div class="progs">${categoryRows}</div>
  ${alertBlock}
  <div class="cta">
    <a href="${APP_URL}/budgets" class="btn">View full budget</a>
    <p class="btnsub">Tap to log today's expenses</p>
  </div>
  ${emailFooter([
    { href: settingsUrl, label: 'Manage alerts' },
    { href: settingsUrl, label: 'Unsubscribe' },
  ], "You're receiving this as part of your monthly budget digest.<br>WaiseKa · waiseKa.app")}
</div></div></body></html>`
  await sendMail(data.email, `Your ${data.monthName} budget check-in - WaiseKa`, html)
}

// ─── 4. Re-Engage ─────────────────────────────────────────────────────────────

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
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WaiseKa - We've Missed You</title><style>${BASE_CSS}
  .goal-alert{margin:0 44px 20px;border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.65;color:#0D3D1F;background:#EEF9F3;border:1px solid #C8E3C4}
</style></head><body>
<div class="wrap"><div class="shell">
  ${emailHeader()}
  <div class="hero">
    <div class="hico">🦉</div>
    <h1 class="h1">We've missed you, ${data.firstName}</h1>
    <p class="hsub">It's been ${data.daysSinceLogin} days since your last visit. Your money is waiting for a check-in.</p>
  </div>
  <div class="body">
    <p class="gr">Hey ${data.firstName},</p>
    <p class="p">Life gets busy - we get it. But even 2 minutes of logging can make a big difference in staying on top of your finances. Here's a quick peek at what's happened since you were last here:</p>
  </div>
  ${statsTable([
    { emoji: '📅', label: 'Unlogged days', value: String(data.daysSinceLogin), color: '#C0392B' },
    { emoji: '🗓', label: `Days left in ${data.monthName}`, value: String(data.daysRemaining), color: '#0D3D1F' },
    { emoji: '🎯', label: 'Goal progress', value: `${data.topGoalPercent}%`, color: '#1A6B3A' },
  ])}
  <div class="goal-alert">
    <span style="font-size:18px;flex-shrink:0;margin-top:1px">💡</span>
    <div><b>Your savings goal is still alive.</b> You're ${data.topGoalPercent}% of the way to your ${data.topGoalName} target of ${data.topGoalTarget}. Don't let a gap in logging throw off your momentum.</div>
  </div>
  <div class="cta">
    <a href="${APP_URL}/dashboard" class="btn">Log back in</a>
    <p class="btnsub">Pick up right where you left off</p>
  </div>
  <div class="hr"></div>
  <div class="tip"><b>Did you know?</b> Users who log at least 3 times per week are 2× more likely to hit their savings goals within their target timeline.</div>
  ${emailFooter([
    { href: settingsUrl, label: 'Manage notifications' },
    { href: settingsUrl, label: 'Unsubscribe' },
  ], `You're receiving this because you haven't logged in for ${data.daysSinceLogin} days.<br>WaiseKa · waiseKa.app`)}
</div></div></body></html>`
  await sendMail(data.email, `We've missed you, ${data.firstName} - WaiseKa`, html)
}

// ─── 5. Monthly Report ────────────────────────────────────────────────────────

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
  const categoryRows = data.topCategories.map((c) => `
    <div style="display:flex;align-items:center;padding:10px 14px;border-top:1px solid #C8E3C4;gap:10px">
      <div style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${c.dotColor}"></div>
      <span style="font-size:12px;color:#0D3D1F;flex:1">${c.name}</span>
      <span style="font-size:10px;color:#2A9654;font-family:'DM Mono',monospace">${c.txnCount} transactions</span>
      <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:#C0392B">${c.totalSpent}</span>
    </div>`).join('')

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WaiseKa - Your ${data.monthName} ${data.year} Monthly Report</title><style>${BASE_CSS}
  .sect-lbl{font-size:10px;font-weight:700;color:#1A6B3A;letter-spacing:0.08em;text-transform:uppercase;padding:0 44px;margin-bottom:10px}
  .txns{margin:0 44px 20px;border:1px solid #C8E3C4;border-radius:12px;overflow:hidden}
  .txnhd{background:#EEF9F3;padding:9px 14px;font-size:10px;font-weight:700;color:#1A6B3A;letter-spacing:0.06em;text-transform:uppercase}
  .insight-alert{margin:0 44px 20px;border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.65;color:#0D3D1F;background:#EEF9F3;border:1px solid #C8E3C4}
</style></head><body>
<div class="wrap"><div class="shell">
  ${emailHeader()}
  <div class="hero">
    <div class="hico">📈</div>
    <h1 class="h1">Your ${data.monthName} ${data.year} monthly report</h1>
    <p class="hsub">A complete picture of how your month went - income, spending, and savings.</p>
  </div>
  <div class="body">
    <p class="gr">Hey ${data.firstName},</p>
    <p class="p">${data.monthName} was a solid month. You stayed within budget on ${data.categoriesOnBudget} out of ${data.totalCategories} categories and added ${data.totalSaved} to your savings. Here's the full breakdown:</p>
  </div>
  ${statsTable([
    { emoji: '💰', label: 'Total income', value: data.totalIncome, color: '#2A9654' },
    { emoji: '💸', label: 'Total spent', value: data.totalSpent, color: '#C0392B' },
    { emoji: '🏦', label: 'Saved', value: data.totalSaved, color: '#1A6B3A' },
  ])}
  <p class="sect-lbl">Top spending categories</p>
  <div class="txns">
    <div class="txnhd">Highest expenses in ${data.monthName}</div>
    ${categoryRows}
  </div>
  <div style="height:12px"></div>
  <div class="insight-alert">
    <span style="font-size:18px;flex-shrink:0;margin-top:1px">🔍</span>
    <div><b>WaiseKa insight:</b> Your ${data.insight.comparedCategory} spend ${data.insight.changeDirection} ${data.insight.changePercent}% vs. ${data.insight.comparedMonth}. If you maintain this trend, you'll free up an extra ${data.insight.monthlySavingsFree}/month for savings.</div>
  </div>
  <div class="cta">
    <a href="${APP_URL}/reports" class="btn">View full ${data.monthName} report</a>
    <p class="btnsub">Set your ${data.nextMonthName} budget while you're at it</p>
  </div>
  ${emailFooter([
    { href: settingsUrl, label: 'Manage reports' },
    { href: settingsUrl, label: 'Unsubscribe' },
  ], 'Your monthly report is generated on the 1st of each month.<br>WaiseKa · waiseKa.app')}
</div></div></body></html>`
  await sendMail(data.email, `Your ${data.monthName} ${data.year} financial report - WaiseKa`, html)
}

// ─── 6. Spending Alert ────────────────────────────────────────────────────────

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
  const txnRows = data.recentTxns.map((t) => `
    <div style="display:flex;align-items:center;padding:10px 14px;border-top:1px solid #C8E3C4;gap:10px">
      <div style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:#E05A5A"></div>
      <span style="font-size:12px;color:#0D3D1F;flex:1">${t.merchantName} <span style="font-size:10px;color:#999">${t.date}</span></span>
      <span style="font-size:10px;color:#2A9654;font-family:'DM Mono',monospace">${t.label}</span>
      <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:#C0392B">${t.amount}</span>
    </div>`).join('')

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WaiseKa - Budget Alert: ${data.categoryName} Limit Exceeded</title><style>${BASE_CSS}
  .sect-lbl{font-size:10px;font-weight:700;color:#1A6B3A;letter-spacing:0.08em;text-transform:uppercase;padding:0 44px;margin-bottom:10px}
  .txns{margin:0 44px 20px;border:1px solid #C8E3C4;border-radius:12px;overflow:hidden}
  .txnhd{background:#EEF9F3;padding:9px 14px;font-size:10px;font-weight:700;color:#1A6B3A;letter-spacing:0.06em;text-transform:uppercase}
  .alert-dng{margin:0 44px 20px;border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.65;color:#0D3D1F;background:#FDE8E8;border:1px solid #F0A0A0}
</style></head><body>
<div class="wrap"><div class="shell">
  ${emailHeader()}
  <div class="hero">
    <div class="hico" style="background:#FDE8E8;border-color:#F0A0A0">🚨</div>
    <h1 class="h1">You've exceeded your ${data.categoryName} budget</h1>
    <p class="hsub">Your ${data.categoryName} category went over limit today. Here's what happened.</p>
  </div>
  <div class="body">
    <p class="gr">Hey ${data.firstName},</p>
    <p class="p">A transaction logged today pushed your ${data.categoryName} category over its ${data.budgetLimit} monthly limit. Here's a summary of where things stand:</p>
  </div>
  ${statsTable([
    { emoji: '🎯', label: 'Budget limit', value: data.budgetLimit, color: '#0D3D1F' },
    { emoji: '💸', label: 'Amount spent', value: data.totalSpent, color: '#C0392B' },
    { emoji: '📛', label: 'Over by', value: data.overBy, color: '#C0392B' },
  ])}
  <div class="alert-dng">
    <span style="font-size:18px;flex-shrink:0;margin-top:1px">❌</span>
    <div><b>Budget exceeded.</b> Your last transaction of ${data.triggerAmount} at ${data.triggerMerchant} crossed the limit. You still have ${data.daysRemaining} days left in ${data.monthName}.</div>
  </div>
  <p class="sect-lbl">Recent ${data.categoryName} transactions</p>
  <div class="txns">
    <div class="txnhd">This month's ${data.categoryName}</div>
    ${txnRows}
  </div>
  <div class="cta">
    <a href="${APP_URL}/budgets" class="btn">Adjust my budget</a>
    <p class="btnsub">Or review and re-categorize transactions</p>
  </div>
  <div class="tip"><b>Quick fix:</b> You can move unused budget from another category (e.g., ${data.surplusCategory} has ${data.surplusCategoryRemaining} remaining) to cover the overage.</div>
  ${emailFooter([
    { href: settingsUrl, label: 'Manage alert settings' },
    { href: settingsUrl, label: 'Unsubscribe' },
  ], "You're receiving this because budget alerts are enabled.<br>WaiseKa · waiseKa.app", 'WaiseKa Alerts')}
</div></div></body></html>`
  await sendMail(data.email, `Budget alert: ${data.categoryName} limit exceeded - WaiseKa`, html)
}

// ─── 7. Email Verification ───────────────────────────────────────────────────

export async function sendVerificationEmail(data: { firstName: string; email: string; verifyUrl: string }) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WaiseKa - Verify your email</title><style>${BASE_CSS}</style></head><body>
<div class="wrap"><div class="shell">
  ${emailHeader()}
  <div class="hero">
    <div class="hico">✉️</div>
    <h1 class="h1">Verify your email address</h1>
    <p class="hsub">One quick step to secure your WaiseKa account. This link expires in 24 hours.</p>
  </div>
  <div class="body">
    <p class="gr">Hey ${data.firstName},</p>
    <p class="p">Thanks for signing up! Click the button below to confirm your email address and activate your account. If you didn't create a WaiseKa account, you can safely ignore this email.</p>
  </div>
  <div class="cta">
    <a href="${data.verifyUrl}" class="btn">Verify my email</a>
    <p class="btnsub">Link expires in 24 hours · Never share this with anyone</p>
  </div>
  <div class="hr"></div>
  <div class="tip"><b>Having trouble?</b> Copy and paste this URL into your browser:<br><span style="font-family:'DM Mono',monospace;font-size:11px;color:#2A9654;word-break:break-all">${data.verifyUrl}</span></div>
  ${emailFooter([
    { href: `${APP_URL}/login`, label: 'Back to login' },
  ], "You're receiving this because you created a WaiseKa account.<br>WaiseKa · waiseKa.app", 'WaiseKa Security')}
</div></div></body></html>`
  await sendMail(data.email, 'Verify your WaiseKa email address', html)
}

// ─── 8. Savings Milestone ─────────────────────────────────────────────────────

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
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WaiseKa - ${data.goalName} Milestone Reached!</title><style>${BASE_CSS}
  .milestone{margin:0 44px 20px;background:#1A6B3A;border-radius:14px;padding:20px;text-align:center}
  .ms-amt{font-family:'DM Mono',monospace;font-size:30px;font-weight:500;color:#fff;margin-bottom:4px}
  .ms-lbl{font-size:11px;color:#C2EDD0;font-family:'DM Mono',monospace}
  .ms-bar-bg{background:rgba(255,255,255,0.2);border-radius:100px;height:8px;margin:14px 0 6px}
  .ms-bar-f{height:8px;border-radius:100px;background:#56C97F}
  .ms-range{display:flex;justify-content:space-between;font-size:10px;font-family:'DM Mono',monospace;color:#C2EDD0}
  .insight-alert{margin:0 44px 20px;border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.65;color:#0D3D1F;background:#EEF9F3;border:1px solid #C8E3C4}
</style></head><body>
<div class="wrap"><div class="shell">
  ${emailHeader()}
  <div class="hero">
    <div class="hico">🎉</div>
    <h1 class="h1">You hit a savings milestone!</h1>
    <p class="hsub">Your ${data.goalName} just crossed the ${data.reachedPercent}% mark. This is worth celebrating.</p>
  </div>
  <div class="body">
    <p class="gr">Hey ${data.firstName},</p>
    <p class="p">You've been consistent, and it's paying off. Your ${data.goalName} goal just hit ${data.reachedPercent}% - a huge deal. Keep this pace and you'll reach your full ${data.targetAmount} target in about ${data.monthsToTarget} months.</p>
  </div>
  <div class="milestone">
    <div class="ms-amt">${data.savedAmount}</div>
    <div class="ms-lbl">saved toward your ${data.targetAmount} goal</div>
    <div class="ms-bar-bg"><div class="ms-bar-f" style="width:${data.reachedPercent}%"></div></div>
    <div class="ms-range"><span>₱0</span><span>${data.reachedPercent}% complete</span><span>${data.targetAmount}</span></div>
  </div>
  ${statsTable([
    { emoji: '📆', label: 'Months saving', value: String(data.monthsSaving), color: '#1A6B3A' },
    { emoji: '💪', label: 'Avg / month', value: data.avgPerMonth, color: '#1A6B3A' },
    { emoji: '🏁', label: 'Est. completion', value: data.estCompletionMonthYear, color: '#0D3D1F' },
  ])}
  <div class="insight-alert">
    <span style="font-size:18px;flex-shrink:0;margin-top:1px">🦉</span>
    <div><b>WaiseKa insight:</b> You're in the top ${data.userRankPercent}% of WaiseKa users for savings consistency. Maintaining your current ${data.avgPerMonth}/month pace puts you on track to finish by ${data.estCompletionMonthYear}.</div>
  </div>
  <div class="cta">
    <a href="${APP_URL}/goals" class="btn">View my savings goals</a>
    <p class="btnsub">Add a new goal or boost this one</p>
  </div>
  <div class="hr"></div>
  <div class="tip"><b>Next milestone:</b> At ${data.nextMilestoneAmount} you'll unlock WaiseKa's advanced investment suggestions - personalized options based on your savings pace and risk profile.</div>
  ${emailFooter([
    { href: settingsUrl, label: 'Manage goals' },
    { href: settingsUrl, label: 'Unsubscribe' },
  ], "You're receiving this because milestone notifications are enabled.<br>WaiseKa · waiseKa.app")}
</div></div></body></html>`
  await sendMail(data.email, `🎉 ${data.goalName} milestone reached - WaiseKa`, html)
}
