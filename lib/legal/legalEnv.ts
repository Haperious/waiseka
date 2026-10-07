/**
 * Pure env parsing for the legal pages.
 *
 * Kept free of `server-only` so next.config.ts can import it and fail the
 * build (and `next dev`) when a value is missing. App code should import
 * from `lib/legal/config.ts` instead.
 */

/** Maps each `{{TOKEN}}` used in content/legal/*.md to the env var that supplies it. */
export const LEGAL_TOKEN_ENV_VARS = {
  WEBSITE_URL: 'LEGAL_WEBSITE_URL',
  CONTACT_EMAIL: 'LEGAL_CONTACT_EMAIL',
  SECURITY_EMAIL: 'LEGAL_SECURITY_EMAIL',
  MAILING_ADDRESS: 'LEGAL_MAILING_ADDRESS',
  DB_REGION: 'LEGAL_DB_REGION',
  EMAIL_PROVIDER: 'LEGAL_EMAIL_PROVIDER',
  EMAIL_PROVIDER_REGION: 'LEGAL_EMAIL_PROVIDER_REGION',
  LOG_RETENTION_DAYS: 'LEGAL_LOG_RETENTION_DAYS',
  BACKUP_RETENTION_DAYS: 'LEGAL_BACKUP_RETENTION_DAYS',
  INACTIVITY_PERIOD: 'LEGAL_INACTIVITY_PERIOD',
  DISPUTE_CITY: 'LEGAL_DISPUTE_CITY',
  LIMITED_MODE: 'LEGAL_LIMITED_MODE',
} as const

export type LegalTokenName = keyof typeof LEGAL_TOKEN_ENV_VARS

export const LEGAL_EFFECTIVE_DATE_ENV_VAR = 'LEGAL_EFFECTIVE_DATE'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface LegalConfig {
  tokens: Record<LegalTokenName, string>
  /** ISO date (YYYY-MM-DD) shown on every legal page. */
  effectiveDate: string
}

export class LegalConfigError extends Error {
  readonly missingVars: string[]
  readonly invalidVars: string[]

  constructor(missingVars: string[], invalidVars: string[] = []) {
    const problems: string[] = []
    if (missingVars.length > 0) problems.push(`missing or empty: ${missingVars.join(', ')}`)
    if (invalidVars.length > 0) problems.push(`invalid: ${invalidVars.join(', ')}`)
    super(`Legal pages config error - ${problems.join('; ')}. Set these in .env locally and in the Netlify UI.`)
    this.name = 'LegalConfigError'
    this.missingVars = missingVars
    this.invalidVars = invalidVars
  }
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

/**
 * Read and validate every legal env var.
 *
 * @throws LegalConfigError naming every missing/empty or invalid var at once.
 */
export function readLegalConfig(env: Record<string, string | undefined>): LegalConfig {
  const missingVars: string[] = []
  const invalidVars: string[] = []
  const tokens = {} as Record<LegalTokenName, string>

  for (const [tokenName, envVar] of Object.entries(LEGAL_TOKEN_ENV_VARS) as [LegalTokenName, string][]) {
    const value = env[envVar]?.trim()
    if (!value) {
      missingVars.push(envVar)
      continue
    }
    tokens[tokenName] = value
  }

  const effectiveDate = env[LEGAL_EFFECTIVE_DATE_ENV_VAR]?.trim() ?? ''
  if (!effectiveDate) {
    missingVars.push(LEGAL_EFFECTIVE_DATE_ENV_VAR)
  } else if (!isValidIsoDate(effectiveDate)) {
    invalidVars.push(`${LEGAL_EFFECTIVE_DATE_ENV_VAR} (expected YYYY-MM-DD)`)
  }

  if (missingVars.length > 0 || invalidVars.length > 0) {
    throw new LegalConfigError(missingVars, invalidVars)
  }

  return { tokens, effectiveDate }
}
