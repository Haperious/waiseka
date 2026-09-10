/**
 * WaiseKa - global app constants
 *
 * All tier limits and feature caps live here.
 * Never hardcode these values elsewhere - import from this file.
 */

// ── Import limits ────────────────────────────────────────────────────────────
/** Max CSV/PDF imports per calendar month for free-tier users. */
export const FREE_IMPORT_LIMIT = 3

/** Max CSV/PDF imports per calendar month for premium users. */
export const PREMIUM_IMPORT_LIMIT = 20

// ── Budget limits ────────────────────────────────────────────────────────────
/** Max active budgets a free-tier user may create. */
export const FREE_BUDGET_LIMIT = 10

/** Max active budgets a premium user may create. */
export const PREMIUM_BUDGET_LIMIT = 20

// ── Goal limits ──────────────────────────────────────────────────────────────
/** Max active goals a free-tier user may have at one time. */
export const FREE_GOAL_LIMIT = 3

// ── Account limits ───────────────────────────────────────────────────────────
/** Max non-archived accounts a free-tier user may have at one time. */
export const FREE_ACCOUNT_LIMIT = 5

/** Payload-size guard on preferences.transactionsHiddenAccountIds - not a tier limit. */
export const MAX_HIDDEN_ACCOUNTS = 50

// ── Transaction history ──────────────────────────────────────────────────────
/** Rolling retention window (in days) for free-tier transactions. 3 years = 1095 days. */
export const FREE_HISTORY_DAYS = 1095

/** Rolling retention window (in days) for premium-tier transactions. 7 years = 2555 days. */
export const PREMIUM_HISTORY_DAYS = 2555

// ── AI query cap ─────────────────────────────────────────────────────────────
// The monthly AI query cap is stored in the database, not here.
// Source of truth: GlobalSettings.aiQueryCap, overridable per user via
// User.ai.queriesCapOverride. See lib/models/GlobalSettings.ts and lib/ai-gate.ts.

// ── AI model ─────────────────────────────────────────────────────────────────
/** Anthropic model used for all AI features. Update here to change globally. */
export const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'

// ── Announcements ────────────────────────────────────────────────────────────
/** Max announcement cards shown in one carousel session. */
export const MAX_PENDING_ANNOUNCEMENTS = 3

/** Max characters in an announcement title. */
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 45

/** Max characters in an announcement description. */
export const ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH = 220

/** Default lifetime of an announcement, in days, from publishedAt. */
export const ANNOUNCEMENT_DEFAULT_TTL_DAYS = 30
