'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Copy, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useDefaultAccount } from '@/hooks/useDefaultAccount'
import { extractApiError } from '@/hooks/useFetch'
import { onTransactionSaved } from '@/lib/transactionEvents'
import { MAX_PLANNER_ITEMS, MAX_PLANNER_NAME as MAX_SCENARIO_NAME, PLANNER_MAX_DAYS_AHEAD } from '@/lib/constants'
import { addDays, localToday } from '@/lib/planner/days'
import { projectScenario } from '@/lib/planner/projection'
import type { PlannerItem, PlannerItemType, PlannerScenario } from '@/lib/planner/types'
import type { CurrencyCode } from '@/lib/currency'
import TransactionForm, { type TransactionPrefill } from '../transactions/TransactionForm'
import ItemForm from './ItemForm'
import PlanSettingsForm from './PlanSettingsForm'
import PlannerItems, { NeedsALook } from './PlannerItems'
import PlannerSuggestions, { buildSuggestions } from './PlannerSuggestions'
import PlannerSummary from './PlannerSummary'
import PlannerTimeline from './PlannerTimeline'
import { usePlannerList, usePlannerScenario } from './usePlanner'
import styles from './planner.module.css'

type ItemDialog = { mode: 'add'; type: PlannerItemType } | { mode: 'edit'; item: PlannerItem } | null
type Confirm = { kind: 'removeItem'; item: PlannerItem } | { kind: 'deletePlan' } | null

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 16,
}

function readIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('id')
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

  // A transaction logged anywhere (quick add, this page) changes the starting balance
  useEffect(() => onTransactionSaved(() => void reloadContext()), [reloadContext])

  const projection = useMemo(() => (draft && context ? projectScenario(draft, context) : null), [draft, context])
  const today = context?.today ?? localToday()
  const maxDate = addDays(today, PLANNER_MAX_DAYS_AHEAD)
  const suggestions = useMemo(
    () => (draft && context ? buildSuggestions(context, draft, t) : []),
    [draft, context, t],
  )

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

  // ── Render ─────────────────────────────────────────────────────────────────
  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-playfair), Georgia, serif', lineHeight: 1.1 }}>
          {t('planner.title')}
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, maxWidth: 560, lineHeight: 1.5 }}>
          {t('planner.subtitle')}
        </p>
      </div>
      {scenarios.length > 0 && (
        <Button size="sm" onClick={() => setCreating(true)} disabled={atLimit} title={atLimit ? t('planner.limitReached') : undefined}>
          <Plus style={{ width: 14, height: 14, marginRight: 4 }} />
          <span className="hidden sm:inline">{t('planner.newPlan')}</span>
        </Button>
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
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {header}
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (list.error && !list.data) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {header}
        <div style={{ ...cardStyle, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>{list.error}</p>
          <Button variant="outline" onClick={() => void list.refetch()}>{t('planner.retry')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          {/* ── Plan picker and plan actions ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className={styles.tabs} role="tablist" aria-label={t('planner.yourPlans')} style={{ flex: 1, minWidth: 0 }}>
              {scenarios.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  role="tab"
                  aria-selected={s._id === selectedId}
                  className={`${styles.tab} ${s._id === selectedId ? styles.tabOn : ''}`}
                  onClick={() => choose(s._id)}
                  title={s.name}
                >
                  {s._id === selectedId && draft ? draft.name : s.name}
                </button>
              ))}
            </div>
            {limit !== null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                {atLimit && <Lock size={12} />}
                {t('planner.usage').replace('{n}', String(scenarios.length)).replace('{max}', String(limit))}
              </span>
            )}
          </div>

          {atLimit && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-accent)', backgroundColor: 'var(--color-sage)', border: '1px solid var(--color-accent)', borderRadius: 12, padding: '10px 14px', lineHeight: 1.5 }}>
              {t('planner.limitBanner').replace('{max}', String(limit))}
            </p>
          )}

          {loadError ? (
            <div style={{ ...cardStyle, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>{loadError}</p>
            </div>
          ) : !draft || !context || !projection ? (
            <SkeletonCard />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}>
                    <Pencil size={14} style={{ marginRight: 4 }} />{t('planner.editPlan')}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={atLimit || busy} title={atLimit ? t('planner.limitReached') : undefined}
                    onClick={() => void createPlan({ duplicateOf: draft._id }, t('planner.duplicated'))}>
                    <Copy size={14} style={{ marginRight: 4 }} />{t('planner.duplicate')}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={atLimit || busy} title={atLimit ? t('planner.limitReached') : undefined}
                    onClick={() => void createPlan({ carryFrom: draft._id }, t('planner.carried'))}>
                    <CalendarPlus size={14} style={{ marginRight: 4 }} />{t('planner.carryOver')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'deletePlan' })} style={{ color: 'var(--color-expense)' }}>
                    <Trash2 size={14} style={{ marginRight: 4 }} />{t('common.delete')}
                  </Button>
                </div>
                <span aria-live="polite" style={{ fontSize: '0.72rem', color: saveState === 'error' ? 'var(--color-expense)' : 'var(--color-text-muted)' }}>
                  {saveState === 'saving' ? t('planner.saving')
                    : saveState === 'saved' ? t('planner.saved')
                      : saveState === 'error' ? (
                        <>
                          {saveError ?? t('planner.saveFailed')}{' '}
                          <button type="button" onClick={() => void flush()} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-accent)', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit' }}>
                            {t('planner.retry')}
                          </button>
                        </>
                      ) : t('planner.notSavedAsTransactions')}
                </span>
              </div>

              <div className={styles.layout}>
                <div className={styles.column}>
                  <PlannerSummary
                    projection={projection}
                    currency={draft.currency}
                    endDate={draft.endDate}
                    today={today}
                    accountCount={draft.accountIds.length}
                    onEditSettings={() => setSettingsOpen(true)}
                  />
                  {projection.expired && (
                    <div style={{ ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <p style={{ flex: 1, minWidth: 200, fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{t('planner.expiredHint')}</p>
                      <Button size="sm" disabled={atLimit || busy} onClick={() => void createPlan({ carryFrom: draft._id }, t('planner.carried'))}>
                        {t('planner.carryOver')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>{t('planner.extend')}</Button>
                    </div>
                  )}
                  <NeedsALook
                    items={draft.items} projection={projection} currency={draft.currency} today={today} endDate={draft.endDate}
                    onAdd={(type) => setItemDialog({ mode: 'add', type })}
                    onToggle={(i) => patchItem(i.id, { enabled: !i.enabled })}
                    onEdit={(item) => setItemDialog({ mode: 'edit', item })}
                    onDone={(i, done) => patchItem(i.id, { done })}
                    onRemove={(item) => setConfirm({ kind: 'removeItem', item })}
                  />
                  <PlannerItems
                    items={draft.items} projection={projection} currency={draft.currency} today={today} endDate={draft.endDate}
                    onAdd={(type) => setItemDialog({ mode: 'add', type })}
                    onToggle={(i) => patchItem(i.id, { enabled: !i.enabled })}
                    onEdit={(item) => setItemDialog({ mode: 'edit', item })}
                    onDone={(i, done) => patchItem(i.id, { done })}
                    onRemove={(item) => setConfirm({ kind: 'removeItem', item })}
                  />
                </div>
                <div className={styles.column}>
                  <PlannerSuggestions
                    suggestions={suggestions}
                    currency={draft.currency}
                    onAdd={(added) => {
                      const room = MAX_PLANNER_ITEMS - draft.items.length
                      if (room <= 0) { toast(t('planner.tooManyItems'), 'error'); return }
                      setItems([...draft.items, ...added.slice(0, room)])
                    }}
                  />
                  <PlannerTimeline projection={projection} currency={draft.currency} today={today} />
                </div>
              </div>
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

      {/* ── Add / edit item ── */}
      <Modal
        open={!!itemDialog}
        onClose={() => setItemDialog(null)}
        title={itemDialog?.mode === 'edit' ? t('planner.editItem') : itemDialog?.type === 'income' ? t('planner.addIncome') : t('planner.addExpense')}
        variant="form"
      >
        {itemDialog && draft && (
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
              ? t('planner.removeItemBody').replace('{item}', confirm.item.note ? `${confirm.item.category} · ${confirm.item.note}` : confirm.item.category)
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
