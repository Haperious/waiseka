import { describe, expect, it } from 'vitest'
import { isResetToken } from './resetToken'

describe('isResetToken', () => {
  it('accepts a 64-character hex token', () => {
    expect(isResetToken('a'.repeat(32) + '0123456789abcdef0123456789abcdef')).toBe(true)
  })

  it('rejects Mongo operator objects and other non-strings', () => {
    expect(isResetToken({ $ne: '' })).toBe(false)
    expect(isResetToken({ $gt: '' })).toBe(false)
    expect(isResetToken(['x'])).toBe(false)
    expect(isResetToken(null)).toBe(false)
    expect(isResetToken(undefined)).toBe(false)
  })

  it('rejects strings of the wrong shape', () => {
    expect(isResetToken('')).toBe(false)
    expect(isResetToken('abc')).toBe(false)
    expect(isResetToken('G'.repeat(64))).toBe(false)
    expect(isResetToken('a'.repeat(65))).toBe(false)
  })
})
