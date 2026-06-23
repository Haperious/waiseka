# WaiseKa — Personal Budgeting App

WaiseKa is a full-stack personal finance app built with Next.js, MongoDB, and an AI financial assistant. It helps users track transactions, manage budgets and goals, get AI-powered insights, and stay on top of their finances through an intelligent, context-aware chat interface.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| Auth | NextAuth v5 (credentials + session) |
| Database | MongoDB |
| AI | Anthropic Claude SDK |
| OCR / Import | AWS Textract, Tesseract.js, pdfjs-dist |
| Email | Nodemailer |
| Scheduling | node-cron |
| Hosting | Netlify |

---

## Features

- **Dashboard** — health score, stat cards, budget bars, goal progress, and a yearly spending chart
- **Transactions** — full CRUD with category tagging, search, and filtering
- **Budgets** — create and monitor category budgets with real-time progress tracking
- **Goals** — savings goals with target dates and contribution tracking
- **AI Assistant** — chat-based financial advice powered by Claude, with voice keyword support and context-aware recommendations
- **Reports** — spending breakdowns and trend analysis
- **Import** — CSV and receipt import (OCR via AWS Textract / Tesseract), with monthly usage caps
- **Premium Tier** — free plan includes limited history, budgets (3), goals (3), and imports (3/month); premium unlocks full access
- **Notifications** — scheduled email reminders via node-cron
- **Settings** — currency preference, theme, notification toggles, password management
- **Multi-language & Multi-currency** — locale and currency context throughout

---

## Project Structure

```
waiseka/
├── app/
│   ├── (auth)/           # Login / register pages
│   ├── (protected)/      # Authenticated routes (dashboard, transactions, budgets, goals, ai, reports, settings)
│   └── api/              # API routes (auth, budgets, categories, goals, import, notifications, summary, transactions, users, ai)
├── components/           # Shared UI components (MicrophoneButton, PremiumGate, VoiceKeywordManager)
├── context/              # React contexts (Currency, Language, Theme)
├── hooks/                # Custom hooks
├── lib/                  # Core utilities
│   ├── models/           # Mongoose models (User, Transaction, Budget, Goal, Category)
│   ├── ai.ts             # Claude integration
│   ├── ai-gate.ts        # AI request gating
│   ├── mongodb.ts        # DB connection
│   ├── tier.ts           # isPremium() tier checks
│   ├── currency.ts       # Currency formatting
│   ├── email.ts          # Email sending
│   ├── scheduler.ts      # Cron jobs
│   ├── notifications.ts  # Notification logic
│   ├── importUsage.ts    # Monthly import cap tracking
│   └── translations.ts   # i18n strings
├── types/                # TypeScript type definitions
├── auth.ts               # NextAuth config
└── auth.config.ts        # NextAuth edge config
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas)
- Anthropic API key
- AWS account (for Textract OCR, optional)
- SMTP credentials (for email notifications)

### Installation

```bash
git clone https://github.com/your-username/waiseka.git
cd waiseka
yarn install
```

### Environment Variables

Create a `.env.local` file in the root:

```env
# App
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# MongoDB
MONGODB_URI=mongodb+srv://...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# AWS Textract (optional, for receipt OCR)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Email (Nodemailer)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

### Run Locally

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
yarn build
yarn start
```

---

## Tier Model

| Feature | Free | Premium |
|---|---|---|
| Transaction history | 3 months | Full |
| Budgets | Up to 3 | Unlimited |
| Goals | Up to 3 | Unlimited |
| Imports / month | 3 | 20 |
| AI assistant | Limited | Full |

Tier checks are enforced server-side via `lib/tier.ts → isPremium(user)`. The `PremiumGate` component handles UI-level upgrade prompts.

---

## Key Conventions

- **No Tailwind in new UI** — use CSS variables (`var(--color-card)`, `var(--color-accent)`) matching the existing inline style pattern
- **Tier logic** — always use `isPremium(user)` from `lib/tier.ts`, never hardcode tier checks
- **AI endpoints** — always wrap with `aiGate()` from `lib/ai-gate.ts`
- **Currency** — read from `user.preferences.currency`, format via `lib/currency.ts`
- **Auth** — session-based via NextAuth; protected routes live under `app/(protected)/`

---

## Deployment

The app is deployed on **Netlify**. Push to `main` to trigger a production build.

Ensure all environment variables above are set in the Netlify dashboard under Site Settings → Environment Variables.
