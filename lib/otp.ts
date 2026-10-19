export const OTP_LENGTH = 6

/**
 * Writes `digits` into a code starting at box `from`, keeping any digits after them,
 * capped at OTP_LENGTH. Typing into a filled box replaces just that digit.
 */
export function fillOtp(value: string, from: number, digits: string): string {
  return (value.slice(0, from) + digits + value.slice(from + digits.length)).slice(0, OTP_LENGTH)
}
