import type { Category } from '@/hooks/useCategories'

/**
 * Most-used categories for Filipino workers, in chip order. There is no per-user usage
 * data yet, so this fixed ranking stands in for "most used". Names match by prefix,
 * so "load" matches "Load & Internet".
 */
const COMMON_CATEGORY_PREFIXES = ['food', 'transpo', 'load', 'bills', 'padala', 'shopee']

function commonRank(name: string): number {
  const lower = name.toLowerCase()
  const i = COMMON_CATEGORY_PREFIXES.findIndex((p) => lower.startsWith(p))
  return i === -1 ? COMMON_CATEGORY_PREFIXES.length : i
}

/** Selected category first, then the common ones, then the rest in their saved order. */
export function orderCategoryChips<T extends Pick<Category, 'name'>>(categories: T[], selected: string): T[] {
  return categories
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      if (a.c.name === selected) return -1
      if (b.c.name === selected) return 1
      return commonRank(a.c.name) - commonRank(b.c.name) || a.i - b.i
    })
    .map(({ c }) => c)
}
