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

/**
 * Largest statement or screenshot /api/import/upload accepts. Netlify functions refuse
 * request bodies over ~6 MB and Claude refuses images over 5 MB, so 5 MB is the most
 * that can work end to end.
 */
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024

// ── Budget limits ────────────────────────────────────────────────────────────
/** Max active budgets a free-tier user may create. */
export const FREE_BUDGET_LIMIT = 10

/** Max active budgets a premium user may create. */
export const PREMIUM_BUDGET_LIMIT = 20

// ── Goal limits ──────────────────────────────────────────────────────────────
/** Max active goals a free-tier user may have at one time. */
export const FREE_GOAL_LIMIT = 3

// ── Planner limits ───────────────────────────────────────────────────────────
/** Max saved Planner scenarios a free-tier user may have. */
export const FREE_PLANNER_SCENARIO_LIMIT = 3

/** Max saved Planner scenarios a premium user may have (a storage guard, not a sales limit). */
export const PREMIUM_PLANNER_SCENARIO_LIMIT = 50

/** Max planned items in one scenario - payload-size guard. */
export const MAX_PLANNER_ITEMS = 100

/** How far ahead a scenario's end date may be. */
export const PLANNER_MAX_DAYS_AHEAD = 366

/** Longest plan name and planned-item note. */
export const MAX_PLANNER_NAME = 60
export const MAX_PLANNER_NOTE = 200

// ── Account limits ───────────────────────────────────────────────────────────
/** Max non-archived accounts a free-tier user may have at one time. */
export const FREE_ACCOUNT_LIMIT = 5

/** Payload-size guard on preferences.transactionsHiddenAccountIds - not a tier limit. */
export const MAX_HIDDEN_ACCOUNTS = 50

/** Payload-size guard on preferences.voiceKeywords - not a tier limit. */
export const MAX_VOICE_KEYWORDS = 100

// ── Transaction history ──────────────────────────────────────────────────────
/** Rolling retention window (in days) for free-tier transactions. 3 years = 1095 days. */
export const FREE_HISTORY_DAYS = 1095

/** Rolling retention window (in days) for premium-tier transactions. 7 years = 2555 days. */
export const PREMIUM_HISTORY_DAYS = 2555

// ── Calendar ─────────────────────────────────────────────────────────────────
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ── AI query cap ─────────────────────────────────────────────────────────────
// The monthly AI query cap is stored in the database, not here.
// Source of truth: GlobalSettings.aiQueryCap, overridable per user via
// User.ai.queriesCapOverride. See lib/models/GlobalSettings.ts and lib/ai-gate.ts.

// ── AI model ─────────────────────────────────────────────────────────────────
/** Anthropic model used for all AI features. Update here to change globally. */
export const ANTHROPIC_MODEL = 'claude-sonnet-5-5'

// ── Announcements ────────────────────────────────────────────────────────────
/** Max announcement cards shown in one carousel session. */
export const MAX_PENDING_ANNOUNCEMENTS = 3

/** Max characters in an announcement title. */
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 45

/** Max characters in an announcement description. */
export const ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH = 220

/** Default lifetime of an announcement, in days, from publishedAt. */
export const ANNOUNCEMENT_DEFAULT_TTL_DAYS = 30

// ── Auth ─────────────────────────────────────────────────────────────────────
/**
 * `code` returned by next-auth signIn() when the credentials login is rate
 * limited. Shared by auth.ts (server) and the login page (client).
 */
export const LOGIN_RATE_LIMITED_CODE = 'rate_limited'
