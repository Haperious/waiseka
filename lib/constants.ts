/**
 * WaiseKa — global app constants
 *
 * All tier limits and feature caps live here.
 * Never hardcode these values elsewhere — import from this file.
 */

// ── Import limits ────────────────────────────────────────────────────────────
/** Max CSV/PDF imports per calendar month for free-tier users. */
export const FREE_IMPORT_LIMIT = 3

/** Max CSV/PDF imports per calendar month for premium users. */
export const PREMIUM_IMPORT_LIMIT = 20

// ── Budget limits ────────────────────────────────────────────────────────────
/** Max active budgets a free-tier user may create. */
export const FREE_BUDGET_LIMIT = 3

// ── Goal limits ──────────────────────────────────────────────────────────────
/** Max active goals a free-tier user may have at one time. */
export const FREE_GOAL_LIMIT = 3

// ── Transaction history ──────────────────────────────────────────────────────
/** Rolling look-back window (in days) for free-tier transaction queries. */
export const FREE_HISTORY_DAYS = 90

// ── AI query cap ─────────────────────────────────────────────────────────────
/** Default monthly AI query cap for premium users (overridable per user in DB). */
export const DEFAULT_AI_QUERY_CAP = 30
