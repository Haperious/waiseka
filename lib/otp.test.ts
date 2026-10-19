import { describe, expect, it } from 'vitest'
import { fillOtp } from './otp'

describe('fillOtp', () => {
  it('appends a typed digit', () => {
    expect(fillOtp('12', 2, '3')).toBe('123')
  })

  it('replaces a digit in the middle without dropping the rest', () => {
    expect(fillOtp('123456', 2, '9')).toBe('129456')
  })

  it('fills every box from a pasted or autofilled code', () => {
    expect(fillOtp('', 0, '987654')).toBe('987654')
  })

  it('caps the code at six digits', () => {
    expect(fillOtp('1234', 4, '56789')).toBe('123456')
  })
})
