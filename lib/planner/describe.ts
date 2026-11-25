import type { TranslationKey } from '@/lib/translations'
import { formatDay } from './days'
import type { ResolvedItem } from './projection'
import type { PlannerItem } from './types'

/** Small badge naming where a linked item comes from. Manual items have none. */
export const SOURCE_BADGE: Partial<Record<PlannerItem['source'], TranslationKey>> = {
  budget: 'planner.sourceBudget',
  card: 'planner.sourceCard',
  recurring: 'planner.sourceRecurring',
}

/**
 * "Due Nov 20", "Spread to Nov 30", "No date · counted today", plus why it isn't counted.
 * Shared by the item rows, the day view and the selection bar's subtitle.
 */
export function describe(
  item: PlannerItem,
  r: ResolvedItem | undefined,
  t: (k: TranslationKey) => string,
  today: string,
  endDate: string,
): { when: string; note?: string } {
  const day = (d: string) => formatDay(d, today)
  let when: string
  if (item.source === 'budget') when = r?.spread ? t('planner.spreadTo').replace('{date}', day(r.spread.to)) : t('planner.thisMonth')
  else if (item.source === 'card') when = r?.day ? t('planner.dueOn').replace('{date}', day(r.day)) : t('planner.noDueDay')
  else if (!item.date) when = item.type === 'income' ? t('planner.noDateIncome').replace('{date}', day(endDate)) : t('planner.noDateExpense')
  else when = r?.overdue ? t('planner.wasDue').replace('{date}', day(item.date)) : day(item.date)

  const status = r?.status
  const note =
    status === 'off' ? t('planner.statusOff')
      : status === 'afterEnd' ? t('planner.statusAfterEnd')
        : status === 'unavailable' ? t('planner.statusUnavailable')
          : status === 'coveredByAccounts' ? t('planner.statusCovered')
            : status === 'nothingLeft' ? (item.source === 'card' ? t('planner.statusNothingOwed') : t('planner.statusSpent'))
              : undefined
  return { when, note }
}
