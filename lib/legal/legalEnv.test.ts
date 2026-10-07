import { describe, expect, it } from 'vitest'
import { LEGAL_EFFECTIVE_DATE_ENV_VAR, LEGAL_TOKEN_ENV_VARS, LegalConfigError, readLegalConfig } from './legalEnv'

const ALL_ENV_VARS = [...Object.values(LEGAL_TOKEN_ENV_VARS), LEGAL_EFFECTIVE_DATE_ENV_VAR]

function completeEnv(): Record<string, string> {
  const env: Record<string, string> = Object.fromEntries(
    Object.values(LEGAL_TOKEN_ENV_VARS).map((envVar) => [envVar, `value-of-${envVar}`])
  )
  env[LEGAL_EFFECTIVE_DATE_ENV_VAR] = '2026-10-15'
  return env
}

function captureConfigError(env: Record<string, string | undefined>): LegalConfigError {
  try {
    readLegalConfig(env)
  } catch (error) {
    if (error instanceof LegalConfigError) return error
    throw error
  }
  throw new Error('expected LegalConfigError')
}

describe('readLegalConfig', () => {
  it('maps every env var to its token and returns the effective date', () => {
    const config = readLegalConfig(completeEnv())
    expect(config.tokens.CONTACT_EMAIL).toBe('value-of-LEGAL_CONTACT_EMAIL')
    expect(Object.keys(config.tokens).sort()).toEqual(Object.keys(LEGAL_TOKEN_ENV_VARS).sort())
    expect(config.effectiveDate).toBe('2026-10-15')
  })

  it('trims surrounding whitespace', () => {
    const env = { ...completeEnv(), LEGAL_DISPUTE_CITY: '  Quezon City  ' }
    expect(readLegalConfig(env).tokens.DISPUTE_CITY).toBe('Quezon City')
  })

  it('throws LegalConfigError listing every missing var at once', () => {
    const error = captureConfigError({})
    expect(error.missingVars.sort()).toEqual([...ALL_ENV_VARS].sort())
    for (const envVar of ALL_ENV_VARS) expect(error.message).toContain(envVar)
  })

  it('treats empty and whitespace-only values as missing', () => {
    const error = captureConfigError({ ...completeEnv(), LEGAL_MAILING_ADDRESS: '', LEGAL_DB_REGION: '   ' })
    expect(error.missingVars).toEqual(['LEGAL_MAILING_ADDRESS', 'LEGAL_DB_REGION'])
  })

  it.each(['15/10/2026', '2026-13-01', '2026-02-30', 'soon'])('rejects an invalid effective date: %s', (date) => {
    const error = captureConfigError({ ...completeEnv(), [LEGAL_EFFECTIVE_DATE_ENV_VAR]: date })
    expect(error.missingVars).toEqual([])
    expect(error.invalidVars[0]).toContain(LEGAL_EFFECTIVE_DATE_ENV_VAR)
  })

  it('reports missing and invalid vars together', () => {
    const error = captureConfigError({ ...completeEnv(), LEGAL_CONTACT_EMAIL: '', [LEGAL_EFFECTIVE_DATE_ENV_VAR]: 'soon' })
    expect(error.missingVars).toEqual(['LEGAL_CONTACT_EMAIL'])
    expect(error.invalidVars).toHaveLength(1)
  })
})
