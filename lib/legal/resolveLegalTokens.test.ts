import { describe, expect, it } from 'vitest'
import { MissingLegalTokenError, resolveLegalTokens } from './resolveLegalTokens'

describe('resolveLegalTokens', () => {
  it('replaces every token, including repeated ones', () => {
    const markdown = 'Email {{CONTACT_EMAIL}} or write to {{MAILING_ADDRESS}}. Again: {{CONTACT_EMAIL}}.'
    const resolved = resolveLegalTokens(markdown, {
      CONTACT_EMAIL: 'privacy@example.com',
      MAILING_ADDRESS: '1 Example St',
    })
    expect(resolved).toBe('Email privacy@example.com or write to 1 Example St. Again: privacy@example.com.')
  })

  it('leaves text without tokens unchanged', () => {
    const markdown = '### 1. Who we are\n\nPlain text with {single} braces and a | table | row.'
    expect(resolveLegalTokens(markdown, { CONTACT_EMAIL: 'x' })).toBe(markdown)
  })

  it('inserts values literally, even ones containing replacement patterns like $&', () => {
    expect(resolveLegalTokens('Cost: {{PRICE}}', { PRICE: '$& $1 $$' })).toBe('Cost: $& $1 $$')
  })

  it('throws MissingLegalTokenError naming each missing token once', () => {
    const markdown = '{{CONTACT_EMAIL}} {{DB_REGION}} {{DISPUTE_CITY}} {{DB_REGION}}'
    try {
      resolveLegalTokens(markdown, { CONTACT_EMAIL: 'x' })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(MissingLegalTokenError)
      expect((error as MissingLegalTokenError).tokenNames).toEqual(['{{DB_REGION}}', '{{DISPUTE_CITY}}'])
      expect((error as Error).message).toContain('{{DB_REGION}}')
    }
  })

  it('rejects malformed placeholders instead of letting them reach the page', () => {
    expect(() => resolveLegalTokens('Hi {{ contact_email }}', { CONTACT_EMAIL: 'x' })).toThrow(MissingLegalTokenError)
  })

  it('does not resolve inherited object keys as tokens', () => {
    expect(() => resolveLegalTokens('{{constructor}}', {})).toThrow(MissingLegalTokenError)
  })
})
