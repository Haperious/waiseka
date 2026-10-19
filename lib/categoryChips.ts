import type { Category } from '@/hooks/useCategories'

/**
 * Fallback ranking for users without much history yet: categories common for
 * Filipino workers, matched by name prefix ("load" matches "Load & Internet").
 */
const COMMON_CATEGORY_PREFIXES = ['food', 'transpo', 'load', 'bills', 'padala', 'shopee']

function commonRank(name: string): number {
  const lower = name.toLowerCase()
  const i = COMMON_CATEGORY_PREFIXES.findIndex((p) => lower.startsWith(p))
  return i === -1 ? COMMON_CATEGORY_PREFIXES.length : i
}

/**
 * Chip order: the selected category first, then the user's most used (by recent
 * transaction count), then the common Filipino categories, then the rest in their
 * saved order.
 */
export function orderCategoryChips<T extends Pick<Category, 'name' | 'usageCount'>>(categories: T[], selected: string): T[] {
  return categories
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      if (a.c.name === selected) return -1
      if (b.c.name === selected) return 1
      return (
        (b.c.usageCount ?? 0) - (a.c.usageCount ?? 0) ||
        commonRank(a.c.name) - commonRank(b.c.name) ||
        a.i - b.i
      )
    })
    .map(({ c }) => c)
}
