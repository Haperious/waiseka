import { describe, expect, it } from 'vitest'
import { orderCategoryChips } from './categoryChips'

const cats = (...list: [string, number?][]) => list.map(([name, usageCount]) => ({ name, usageCount }))
const names = (list: { name: string }[]) => list.map((c) => c.name)

describe('orderCategoryChips', () => {
  it('puts the most used categories first', () => {
    const ordered = orderCategoryChips(cats(['Rent', 2], ['Groceries', 9], ['Health', 0], ['Coffee', 5]), '')
    expect(names(ordered)).toEqual(['Groceries', 'Coffee', 'Rent', 'Health'])
  })

  it('keeps the selected category first regardless of usage', () => {
    const ordered = orderCategoryChips(cats(['Rent', 2], ['Groceries', 9], ['Health', 0]), 'Health')
    expect(names(ordered)).toEqual(['Health', 'Groceries', 'Rent'])
  })

  it('falls back to the common Filipino categories when there is no usage yet', () => {
    const ordered = orderCategoryChips(cats(['Health'], ['Shopee'], ['Food & Pulutan'], ['Load & Internet'], ['Rent']), '')
    expect(names(ordered)).toEqual(['Food & Pulutan', 'Load & Internet', 'Shopee', 'Health', 'Rent'])
  })

  it('breaks usage ties with the common ranking, then saved order', () => {
    const ordered = orderCategoryChips(cats(['Rent', 3], ['Transpo', 3], ['Bills', 3], ['Health', 3]), '')
    expect(names(ordered)).toEqual(['Transpo', 'Bills', 'Rent', 'Health'])
  })
})
