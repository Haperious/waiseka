import { describe, it, expect } from 'vitest'
import { computeAssetBalance, computeOutstanding, nextDueDate } from './accountBalance'

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

const activity = (a: Partial<{ income: number; expense: number; savings: number; transferIn: number; transferOut: number }>) => ({
  income: 0, expense: 0, savings: 0, transferIn: 0, transferOut: 0, ...a,
})

describe('computeOutstanding', () => {
  it('is the balance owed when the card was added, before any activity', () => {
    expect(computeOutstanding(8200, undefined)).toBe(8200)
  })

  it('adds spending and cash advances, subtracts payments and refunds', () => {
    // 8,200 owed + 1,500 spent + 300 cash advance - 5,000 paid - 200 refund
    expect(computeOutstanding(8200, activity({ expense: 1500, transferOut: 300, transferIn: 5000, income: 200 }))).toBe(4800)
  })

  it('goes negative (a credit balance) after an overpayment', () => {
    expect(computeOutstanding(1000, activity({ transferIn: 1500 }))).toBe(-500)
  })
})

describe('computeAssetBalance', () => {
  it('starts from the opening balance and applies activity', () => {
    expect(computeAssetBalance(1000, activity({ income: 500, expense: 200, savings: 100, transferIn: 50, transferOut: 25 }))).toBe(1225)
  })
})
