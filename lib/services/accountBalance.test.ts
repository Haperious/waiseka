import { describe, it, expect } from 'vitest'
import { nextDueDate } from './accountBalance'

function utc(year: number, month1: number, day: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day))
}

describe('nextDueDate', () => {
  it('returns null when the account has no dueDay', () => {
    expect(nextDueDate({ dueDay: null }, utc(2026, 9, 10))).toBeNull()
  })

  it('returns this month\'s due date when it has not passed yet', () => {
    expect(nextDueDate({ dueDay: 26 }, utc(2026, 9, 23))).toEqual(utc(2026, 9, 26))
  })

  it('returns today when due today', () => {
    expect(nextDueDate({ dueDay: 23 }, utc(2026, 9, 23))).toEqual(utc(2026, 9, 23))
  })

  it('rolls over to next month once this month\'s due date has passed', () => {
    expect(nextDueDate({ dueDay: 15 }, utc(2026, 9, 23))).toEqual(utc(2026, 10, 15))
  })

  it('clamps dueDay 31 to the actual last day of a shorter month', () => {
    expect(nextDueDate({ dueDay: 31 }, utc(2027, 2, 5))).toEqual(utc(2027, 2, 28))
  })

  it('rolls a December due date over into January of the next year', () => {
    expect(nextDueDate({ dueDay: 5 }, utc(2026, 12, 20))).toEqual(utc(2027, 1, 5))
  })
})
