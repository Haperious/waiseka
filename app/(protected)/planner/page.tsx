'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Banknote, Check, CreditCard, ListPlus, Lock, PieChart, Plus, Repeat, Trash2, Wallet } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Segmented from '@/components/ui/Segmented'
import Select from '@/components/ui/Select'
import SelectionActions from '@/components/ui/SelectionActions'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useDefaultAccount } from '@/hooks/useDefaultAccount'
import { extractApiError } from '@/hooks/useFetch'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { onTransactionSaved } from '@/lib/transactionEvents'
import { formatAmount } from '@/lib/currency'
import {
  MAX_PLANNER_ITEMS, MAX_PLANNER_NAME as MAX_SCENARIO_NAME, PLANNER_MAX_DAYS_AHEAD, PLANNER_VIEW_STORAGE_KEY,
} from '@/lib/constants'
import { addDays, formatDay, localToday } from '@/lib/planner/days'
import { describe } from '@/lib/planner/describe'
import { findFixSuggestion, type FixSuggestion } from '@/lib/planner/fixSuggestion'
import { itemLabel, projectScenario, type Projection } from '@/lib/planner/projection'
import type { PlannerItem, PlannerItemType, PlannerScenario } from '@/lib/planner/types'
import type { CurrencyCode } from '@/lib/currency'
import TransactionForm, { type TransactionPrefill } from '../transactions/TransactionForm'
import BulkItemForm from './BulkItemForm'
import ItemForm from './ItemForm'
import PlanMenu from './PlanMenu'
import PlanPicker from './PlanPicker'
import PlanSettingsForm from './PlanSettingsForm'
import PlannerItems from './PlannerItems'
import PlannerLowestCard from './PlannerLowestCard'
import PlannerSuggestions, { buildSuggestions } from './PlannerSuggestions'
import PlannerSummary, { PlannerHeroMobile } from './PlannerSummary'
import PlannerTimeline from './PlannerTimeline'
import { usePlannerList, usePlannerScenario } from './usePlanner'
import styles from './planner.module.css'

type ItemDialog = { mode: 'add'; type: PlannerItemType } | { mode: 'bulk'; type: PlannerItemType } | { mode: 'edit'; item: PlannerItem } | null
type Confirm = { kind: 'removeItem'; item: PlannerItem } | { kind: 'deletePlan' } | null
type View = 'items' | 'days'
type MobileTab = PlannerItemType | 'days'

/** Same breakpoint as the desktop rules in planner.module.css. */
const DESKTOP_QUERY = '(min-width: 1024px)'

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 16,
}

function readIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('id')
}

/** The sheet's leading glyph: where the item comes from, or its type for manual ones. */
function itemIcon(item: PlannerItem) {
  if (item.source === 'recurring') return Repeat
  if (item.source === 'budget') return PieChart
  if (item.source === 'card') return CreditCard
  return item.type === 'income' ? Banknote : Wallet
}

export default function PlannerPage() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { currency: primaryCurrency } = useCurrency()
  const { accounts } = useAccounts()
  const { defaultAccountId } = useDefaultAccount()
  const list = usePlannerList()
  const scenarios = useMemo(() => list.data?.scenarios ?? [], [list.data])
  const limit = list.data?.limit ?? null
  const atLimit = limit !== null && scenarios.length >= limit

  const [chosenId, setChosenId] = useState<string | null>(readIdFromUrl)
  // The chosen plan if it still exists, else the most recently changed one
  const selectedId = scenarios.some((s) => s._id === chosenId) ? chosenId : scenarios[0]?._id ?? null
  const selectedListItem = scenarios.find((s) => s._id === selectedId)

  const { mutate: mutateList, refetch: refetchList } = list
  const onSaved = useCallback((s: PlannerScenario) => {
    mutateList((prev) => prev && {
      ...prev,
      scenarios: prev.scenarios.map((x) => (x._id === s._id ? { ...x, name: s.name, endDate: s.endDate, itemCount: s.items.length, updatedAt: s.updatedAt } : x)),
    })
  }, [mutateList])
  const { draft, context, loadError, saveState, saveError, update, flush, reloadContext } = usePlannerScenario(selectedId, onSaved)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCurrency, setNewCurrency] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [itemDialog, setItemDialog] = useState<ItemDialog>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [logging, setLogging] = useState<{ item: PlannerItem; prefill: TransactionPrefill } | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [typeTab, setTypeTab] = useState<PlannerItemType>('expense')

  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [storedView, setStoredView] = useLocalStorage(PLANNER_VIEW_STORAGE_KEY)
  const view: View = storedView === 'days' ? 'days' : 'items'
  const mobileTab: MobileTab = view === 'days' ? 'days' : typeTab

  // The latest plan, for Undo callbacks that run after later edits
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])

  // A transaction logged anywhere (quick add, this page) changes the starting balance
  useEffect(() => onTransactionSaved(() => void reloadContext()), [reloadContext])

  const projection = useMemo(() => (draft && context ? projectScenario(draft, context) : null), [draft, context])
  const today = context?.today ?? localToday()
  const maxDate = addDays(today, PLANNER_MAX_DAYS_AHEAD)
  const suggestions = useMemo(
    () => (draft && context ? buildSuggestions(context, draft, t) : []),
    [draft, context, t],
  )
  const fix = useMemo(() => (draft && projection ? findFixSuggestion(draft.items, projection) : null), [draft, projection])
  // Planned items past their date, oldest first: the "needs a look" pill selects the first
  const overdue = useMemo(
    () => (draft && projection
      ? draft.items
        .filter((i) => !i.done && projection.items[i.id]?.overdue)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      : []),
    [draft, projection],
  )

  // The selection is an open item that still exists in this plan
  const selectedItem = (selectedItemId && draft?.items.find((i) => i.id === selectedItemId && !i.done)) || null
  // Removed, marked done or the plan changed: drop it so it doesn't pop back
  if (selectedItemId && draft && !selectedItem) setSelectedItemId(null)

  const currencies = useMemo(() => {
    const codes = new Set<string>([primaryCurrency])
    for (const a of accounts) if (!a.isArchived) codes.add(a.currency)
    return [...codes]
  }, [accounts, primaryCurrency])

  // ── Plan-level actions ─────────────────────────────────────────────────────
  const createPlan = async (body: Record<string, unknown>, okMessage: string) => {
    setBusy(true)
    try {
      await flush()
      const res = await fetch('/api/planner/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, today: localToday() }),
      })
      if (!res.ok) {
        toast(await extractApiError(res), 'error')
        return false
      }
      const created = (await res.json()) as PlannerScenario
      await refetchList()
      setChosenId(created._id)
      window.history.replaceState(null, '', `/planner?id=${created._id}`)
      toast(okMessage, 'success')
      return true
    } catch {
      toast(t('common.genericError'), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const submitNewPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim() || t('planner.defaultName')
    const ok = await createPlan({ name, currency: newCurrency || primaryCurrency }, t('planner.created'))
    if (ok) {
      setCreating(false)
      setNewName('')
    }
  }

  const deletePlan = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const res = await fetch(`/api/planner/scenarios/${draft._id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await extractApiError(res))
      setConfirm(null)
      setChosenId(null)
      window.history.replaceState(null, '', '/planner')
      await refetchList()
      toast(t('planner.deleted'), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.genericError'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const choose = (id: string) => {
    setChosenId(id)
    window.history.replaceState(null, '', `/planner?id=${id}`)
  }

  // ── Item actions ───────────────────────────────────────────────────────────
  const setItems = (items: PlannerItem[]) => update({ items })
  const saveItem = (item: PlannerItem) => {
    if (!draft) return
    const exists = draft.items.some((i) => i.id === item.id)
    if (!exists && draft.items.length >= MAX_PLANNER_ITEMS) {
      toast(t('planner.tooManyItems'), 'error')
      return
    }
    setItems(exists ? draft.items.map((i) => (i.id === item.id ? item : i)) : [...draft.items, item])
    setItemDialog(null)
  }
  /** Adds the rows from "Add several" in one change, with Undo. */
  const saveItems = (added: PlannerItem[]) => {
    if (!draft) return
    const room = MAX_PLANNER_ITEMS - draft.items.length
    if (added.length > room) {
      toast(t('planner.tooManyItems'), 'error')
      return
    }
    const ids = new Set(added.map((i) => i.id))
    const scenarioId = draft._id
    setItems([...draft.items, ...added])
    setItemDialog(null)
    toast(
      added.length === 1 ? t('planner.bulkAddedOne') : t('planner.bulkAdded').replace('{n}', String(added.length)),
      'success',
      {
        label: t('planner.undo'),
        onClick: () => {
          const current = draftRef.current
          if (!current || current._id !== scenarioId) return
          update({ items: current.items.filter((i) => !ids.has(i.id)) })
        },
      },
    )
  }
  const patchItem = (id: string, patch: Partial<PlannerItem>) =>
    draft && setItems(draft.items.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  const startLogging = (item: PlannerItem) => {
    if (!draft) return
    // An account in the plan, so the logged entry lands where the plan expects it
    const planAccounts = draft.accountIds.filter((id) => accounts.some((a) => a._id === id && a.type !== 'credit'))
    const accountId = planAccounts.includes(defaultAccountId) ? defaultAccountId : planAccounts[0]
    const date = item.date && item.date <= maxDate ? item.date : today
    setItemDialog(null)
    setLogging({
      item,
      prefill: { type: item.type, amount: item.amount, category: item.category, description: item.note, date, ...(accountId ? { accountId } : {}) },
    })
  }

  const selectItem = (item: PlannerItem) => setSelectedItemId((cur) => (cur === item.id ? null : item.id))
  const clearSelection = useCallback(() => setSelectedItemId(null), [])

  /** Moves an expense to after the next income, with Undo. */
  const moveItem = (f: FixSuggestion) => {
    if (!draft) return
    const id = f.item.id
    const oldDate = f.item.date
    const scenarioId = draft._id
    patchItem(id, { date: f.toDay })
    toast(
      t('planner.moved').replace('{item}', itemLabel(f.item)).replace('{day}', formatDay(f.toDay, today)),
      'success',
      {
        label: t('planner.undo'),
        onClick: () => {
          const current = draftRef.current
          if (!current || current._id !== scenarioId) return
          update({ items: current.items.map((i) => (i.id === id ? { ...i, date: oldDate } : i)) })
        },
      },
    )
  }

  const setView = (v: View) => setStoredView(v)
  const onMobileTab = (v: string) => {
    if (v === 'days') {
      setView('days')
    } else {
      setTypeTab(v as PlannerItemType)
      setView('items')
    }
  }

  const reviewOverdue = () => {
    const first = overdue[0]
    if (!first) return
    setView('items')
    setTypeTab(first.type)
    setSelectedItemId(first.id)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const header = (
    <div className={styles.header}>
      <div style={{ minWidth: 0 }}>
        <h1 className={styles.title}>{t('planner.title')}</h1>
        <p className={styles.subtitle}>{t('planner.subtitle')}</p>
      </div>
      {draft && !loadError && (
        <div className={styles.headerActions}>
          <Button
            size="sm"
            variant="outline"
            className={styles.addButton}
            aria-label={t('planner.addSeveral')}
            onClick={() => setItemDialog({ mode: 'bulk', type: isDesktop ? 'expense' : typeTab })}
          >
            <ListPlus aria-hidden style={{ width: 14, height: 14 }} />
            <span className={styles.addLong}>{t('planner.addSeveral')}</span>
          </Button>
          <Button size="sm" className={styles.addButton} onClick={() => setItemDialog({ mode: 'add', type: 'expense' })}>
            <Plus aria-hidden style={{ width: 14, height: 14 }} />
            <span className={styles.addLong}>{t('planner.addItem')}</span>
            <span className={styles.addShort}>{t('planner.addShort')}</span>
          </Button>
        </div>
      )}
    </div>
  )

  const newPlanForm = (
    <form onSubmit={submitNewPlan} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Input
        id="planner-new-name"
        label={t('planner.planName')}
        placeholder={t('planner.defaultName')}
        value={newName}
        maxLength={MAX_SCENARIO_NAME}
        onChange={(e) => setNewName(e.target.value)}
        autoFocus
      />
      {currencies.length > 1 && (
        <Select
          label={t('planner.currency')}
          value={newCurrency || primaryCurrency}
          onValueChange={setNewCurrency}
          options={currencies.map((c) => ({ value: c, label: c }))}
        />
      )}
      <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{t('planner.newPlanHint')}</p>
      <Button type="submit" loading={busy}>{t('planner.createPlan')}</Button>
    </form>
  )

  if (list.loading && !list.data) {
    return (
      <div className={styles.page}>
        {header}
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (list.error && !list.data) {
    return (
      <div className={styles.page}>
        {header}
        <div style={{ ...cardStyle, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>{list.error}</p>
          <Button variant="outline" onClick={() => void list.refetch()}>{t('planner.retry')}</Button>
        </div>
      </div>
    )
  }

  const needsPill = overdue.length > 0 && (
    <button type="button" className={styles.needsPill} onClick={reviewOverdue}>
      <AlertCircle aria-hidden size={13} />
      {overdue.length === 1 ? t('planner.needsALookCountOne') : t('planner.needsALookCount').replace('{n}', String(overdue.length))}
    </button>
  )

  const selection = (p: Projection, d: PlannerScenario) => {
    if (!selectedItem) return null
    const item = selectedItem
    const resolved = p.items[item.id]
    const { when } = describe(item, resolved, t, today, d.endDate)
    const amount = `${item.type === 'income' ? '+' : '-'}${formatAmount(resolved?.amount ?? item.amount, d.currency)}`
    const Icon = itemIcon(item)
    // On mobile the sheet would sit under the modal, so it closes first (as on Categories)
    const log = () => {
      if (!isDesktop) clearSelection()
      startLogging(item)
    }
    const edit = () => {
      if (!isDesktop) clearSelection()
      setItemDialog({ mode: 'edit', item })
    }
    const done = () => patchItem(item.id, { done: true })
    const remove = () => setConfirm({ kind: 'removeItem', item })
    return (
      <SelectionActions
        open
        title={itemLabel(item)}
        subtitle={`${amount} · ${when}`}
        sheetLeading={
          <div
            aria-hidden
            className={styles.sheetTile}
            style={{
              backgroundColor: item.type === 'income' ? 'var(--color-income-bg)' : 'var(--color-expense-bg)',
              color: item.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
            }}
          >
            <Icon size={18} />
          </div>
        }
        actions={[
          { key: 'log', label: t('planner.logShort'), variant: 'primary', onClick: log },
          { key: 'done', label: t('planner.markDone'), variant: 'secondary', onClick: done },
          { key: 'edit', label: t('common.edit'), variant: 'ghost', onClick: edit },
          { key: 'remove', label: t('planner.remove'), variant: 'danger', icon: Trash2, iconOnly: true, onClick: remove },
        ]}
        sheetActions={[
          { key: 'log', label: t('planner.logShort'), variant: 'primary', fullWidth: true, onClick: log },
          { key: 'done', label: t('planner.done'), variant: 'secondary', onClick: done },
          { key: 'edit', label: t('common.edit'), variant: 'outline', onClick: edit },
          { key: 'remove', label: t('planner.remove'), variant: 'danger', onClick: remove },
        ]}
        mobileColumns={3}
        barPlacement="sticky"
        escapeDisabled={!!itemDialog || !!logging || !!confirm || settingsOpen || creating}
        onClose={clearSelection}
      />
    )
  }

  return (
    <div className={styles.page}>
      {header}

      {scenarios.length === 0 ? (
        <div style={{ ...cardStyle, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{t('planner.emptyTitle')}</h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.6 }}>{t('planner.emptyBody')}</p>
          </div>
          {newPlanForm}
        </div>
      ) : (
        <>
          {/* ── Plan picker, usage, plan actions, save status ── */}
          <div className={styles.toolbar}>
            <PlanPicker
              scenarios={scenarios}
              selectedId={selectedId}
              name={draft?.name ?? selectedListItem?.name ?? ''}
              endDate={draft?.endDate ?? selectedListItem?.endDate ?? today}
              today={today}
              usageShort={limit !== null ? t('planner.usageShort').replace('{n}', String(scenarios.length)).replace('{max}', String(limit)) : null}
              atLimit={atLimit}
              isDesktop={isDesktop}
              onChoose={choose}
              onNew={() => setCreating(true)}
            />
            {limit !== null && (
              <span className={styles.usage}>
                {atLimit && <Lock aria-hidden size={12} />}
                {t('planner.usage').replace('{n}', String(scenarios.length)).replace('{max}', String(limit))}
              </span>
            )}
            {draft && (
              <PlanMenu
                createDisabled={atLimit || busy}
                limitReached={atLimit}
                onEdit={() => setSettingsOpen(true)}
                onDuplicate={() => void createPlan({ duplicateOf: draft._id }, t('planner.duplicated'))}
                onCarryOver={() => void createPlan({ carryFrom: draft._id }, t('planner.carried'))}
                onDelete={() => setConfirm({ kind: 'deletePlan' })}
              />
            )}
            {draft && (
              <span aria-live="polite" className={styles.saveStatus} style={saveState === 'error' ? { color: 'var(--color-expense)' } : undefined}>
                {saveState === 'saving' ? t('planner.saving')
                  : saveState === 'saved' ? <><Check aria-hidden size={13} />{t('planner.saved')}</>
                    : saveState === 'error' ? (
                      <>
                        {saveError ?? t('planner.saveFailed')}{' '}
                        <button type="button" className={styles.inlineLink} onClick={() => void flush()}>
                          {t('planner.retry')}
                        </button>
                      </>
                    ) : t('planner.notSavedAsTransactions')}
              </span>
            )}
          </div>

          {atLimit && (
            <p className={styles.limitBanner}>{t('planner.limitBanner').replace('{max}', String(limit))}</p>
          )}

          {loadError ? (
            <div style={{ ...cardStyle, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>{loadError}</p>
            </div>
          ) : !draft || !context || !projection ? (
            <SkeletonCard />
          ) : (
            <>
              {/* ── Hero: where you land + the lowest point ── */}
              {isDesktop ? (
                <div className={styles.hero}>
                  <PlannerSummary
                    projection={projection}
                    currency={draft.currency}
                    endDate={draft.endDate}
                    today={today}
                    accountCount={draft.accountIds.length}
                    onEditSettings={() => setSettingsOpen(true)}
                  />
                  <PlannerLowestCard projection={projection} currency={draft.currency} today={today} fix={fix} onMove={moveItem} />
                </div>
              ) : (
                <PlannerHeroMobile
                  projection={projection}
                  currency={draft.currency}
                  endDate={draft.endDate}
                  today={today}
                  fix={fix}
                  onMove={moveItem}
                />
              )}

              {projection.expired && (
                <div className={styles.expiredCard}>
                  <p style={{ flex: 1, minWidth: 200, fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{t('planner.expiredHint')}</p>
                  <Button size="sm" disabled={atLimit || busy} onClick={() => void createPlan({ carryFrom: draft._id }, t('planner.carried'))}>
                    {t('planner.carryOver')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>{t('planner.extend')}</Button>
                </div>
              )}

              <PlannerSuggestions
                suggestions={suggestions}
                currency={draft.currency}
                compact={!isDesktop}
                onAdd={(added) => {
                  const room = MAX_PLANNER_ITEMS - draft.items.length
                  if (room <= 0) { toast(t('planner.tooManyItems'), 'error'); return }
                  setItems([...draft.items, ...added.slice(0, room)])
                }}
              />

              {/* ── View switch ── */}
              <div className={styles.viewBar}>
                {!isDesktop && needsPill}
                {isDesktop ? (
                  <Segmented
                    ariaLabel={t('planner.viewLabel')}
                    className={styles.viewSegmented}
                    value={view}
                    onChange={(v) => setView(v as View)}
                    options={[
                      { value: 'items', label: t('planner.viewItems') },
                      { value: 'days', label: t('planner.viewDays') },
                    ]}
                  />
                ) : (
                  <Segmented
                    ariaLabel={t('planner.viewLabel')}
                    className={styles.viewSegmented}
                    value={mobileTab}
                    onChange={onMobileTab}
                    options={[
                      { value: 'income', label: t('planner.income'), color: 'var(--color-income)' },
                      { value: 'expense', label: t('planner.expenses'), color: 'var(--color-expense)' },
                      { value: 'days', label: t('planner.viewDaysShort') },
                    ]}
                  />
                )}
                {isDesktop && needsPill}
                <p className={styles.switchHint}>{t('planner.switchHint')}</p>
              </div>

              {view === 'days' ? (
                <PlannerTimeline
                  projection={projection}
                  currency={draft.currency}
                  today={today}
                  compact={!isDesktop}
                  onSelect={(id) => setSelectedItemId(id)}
                />
              ) : (
                <PlannerItems
                  items={draft.items}
                  projection={projection}
                  currency={draft.currency}
                  today={today}
                  endDate={draft.endDate}
                  selectedId={selectedItem?.id ?? null}
                  only={isDesktop ? undefined : typeTab}
                  onAdd={(type) => setItemDialog({ mode: 'add', type })}
                  onSelect={selectItem}
                  onToggle={(i) => patchItem(i.id, { enabled: !i.enabled })}
                  onDone={(i, done) => patchItem(i.id, { done })}
                  onRemove={(item) => setConfirm({ kind: 'removeItem', item })}
                />
              )}

              {/* ── Selection: floating bar (desktop) / bottom sheet (mobile) ── */}
              {selection(projection, draft)}
            </>
          )}
        </>
      )}

      {/* ── New plan ── */}
      <Modal open={creating} onClose={() => setCreating(false)} title={t('planner.newPlan')}>
        {newPlanForm}
      </Modal>

      {/* ── Plan settings ── */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('planner.editPlan')} variant="form">
        {draft && context && (
          <PlanSettingsForm
            name={draft.name}
            accountIds={draft.accountIds}
            endDate={draft.endDate}
            accounts={context.accounts}
            currency={draft.currency as CurrencyCode}
            today={today}
            maxDate={maxDate}
            onCancel={() => setSettingsOpen(false)}
            onSave={(patch) => {
              if (Object.keys(patch).length > 0) update(patch)
              setSettingsOpen(false)
            }}
          />
        )}
      </Modal>

      {/* ── Add several items at once ── */}
      <Modal
        open={itemDialog?.mode === 'bulk'}
        onClose={() => setItemDialog(null)}
        title={t('planner.addSeveralTitle')}
        variant="form"
        className="max-w-3xl"
      >
        {itemDialog?.mode === 'bulk' && draft && (
          <BulkItemForm
            defaultType={itemDialog.type}
            currency={draft.currency}
            maxDate={maxDate}
            room={MAX_PLANNER_ITEMS - draft.items.length}
            onSave={saveItems}
            onCancel={() => setItemDialog(null)}
          />
        )}
      </Modal>

      {/* ── Add / edit item ── */}
      <Modal
        open={!!itemDialog && itemDialog.mode !== 'bulk'}
        onClose={() => setItemDialog(null)}
        title={itemDialog?.mode === 'edit' ? t('planner.editItem') : itemDialog?.type === 'income' ? t('planner.addIncome') : t('planner.addExpense')}
        variant="form"
      >
        {itemDialog && itemDialog.mode !== 'bulk' && draft && (
          <ItemForm
            key={itemDialog.mode === 'edit' ? itemDialog.item.id : `new-${itemDialog.type}`}
            item={itemDialog.mode === 'edit' ? itemDialog.item : undefined}
            defaultType={itemDialog.mode === 'add' ? itemDialog.type : undefined}
            currency={draft.currency}
            liveAmount={itemDialog.mode === 'edit' ? projection?.items[itemDialog.item.id]?.amount : undefined}
            minDate={today}
            maxDate={maxDate}
            onSave={saveItem}
            onCancel={() => setItemDialog(null)}
            onLog={startLogging}
            onSwitchToBulk={(type) => setItemDialog({ mode: 'bulk', type })}
          />
        )}
      </Modal>

      {/* ── Log a planned item as a real transaction ── */}
      <Modal open={!!logging} onClose={() => setLogging(null)} title={t('planner.logAsTransaction')} variant="form">
        {logging && (
          <TransactionForm
            prefill={logging.prefill}
            onCancel={() => setLogging(null)}
            onSuccess={() => {
              const id = logging.item.id
              const exists = draft?.items.some((i) => i.id === id)
              // Save any edits made in the item form, then mark it done
              if (draft) {
                setItems(exists
                  ? draft.items.map((i) => (i.id === id ? { ...logging.item, done: true } : i))
                  : draft.items)
              }
              setLogging(null)
              void reloadContext()
            }}
          />
        )}
      </Modal>

      {/* ── Confirmations ── */}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'deletePlan' ? t('planner.deletePlanTitle') : t('planner.removeItemTitle')}
      >
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          {confirm?.kind === 'deletePlan'
            ? t('planner.deletePlanBody').replace('{name}', draft?.name ?? '')
            : confirm?.kind === 'removeItem'
              ? t('planner.removeItemBody').replace('{item}', itemLabel(confirm.item))
              : ''}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" style={{ flex: 1 }} onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            style={{ flex: 1 }}
            loading={busy}
            onClick={() => {
              if (confirm?.kind === 'deletePlan') void deletePlan()
              else if (confirm?.kind === 'removeItem' && draft) {
                setItems(draft.items.filter((i) => i.id !== confirm.item.id))
                setConfirm(null)
              }
            }}
          >
            {confirm?.kind === 'deletePlan' ? t('common.delete') : t('planner.remove')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
