import 'server-only'
import { readLegalConfig, type LegalTokenName } from './legalEnv'

export { LegalConfigError, type LegalTokenName } from './legalEnv'

const legalConfig = readLegalConfig(process.env)

/** Values substituted for `{{TOKEN}}` placeholders in content/legal/*.md. */
export const legalTokens: Record<LegalTokenName, string> = legalConfig.tokens

/** ISO date (YYYY-MM-DD) shown as the effective date on every legal page. */
export const legalEffectiveDate: string = legalConfig.effectiveDate
