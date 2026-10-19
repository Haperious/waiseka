'use client'

import { useState, useMemo, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { CalendarDays, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Transaction } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useAccounts } from '@/hooks/useAccounts'
import { useDefaultAccount } from '@/hooks/useDefaultAccount'
import { useCurrency } from '@/context/CurrencyContext'
import { accountIdForSubmit } from '@/lib/accountSelection'
import MicrophoneButton from '@/components/MicrophoneButton'
import {
  AmountField,
  CategoryChips,
  Field,
  FormModalLayout,
  Segmented,
  ToggleRow,
  moneyLabel,
  type SegmentOption,
} from '@/components/forms/FormParts'
import formStyles from '@/components/forms/forms.module.css'

const UNASSIGNED = ''

type TxType = 'income' | 'expense' | 'savings'

const TYPE_OPTIONS: SegmentOption<TxType>[] = [
  { value: 'expense', label: 'Expense', icon: TrendingDown, color: 'var(--color-expense)' },
  { value: 'income', label: 'Income', icon: TrendingUp, color: 'var(--color-income)' },
  { value: 'savings', label: 'Savings', icon: PiggyBank, color: 'var(--color-savings)' },
]

type DateChoice = 'today' | 'yesterday' | 'other'

interface TransactionFormProps {
  transaction?: Transaction
  onSuccess: () => void
  onCancel: () => void
}

/** Desktop add/edit transaction form. Render inside <Modal variant="form">. */
export default function TransactionForm({ transaction, onSuccess, onCancel }: TransactionFormProps) {
  const { toast } = useToast()
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  const { currency: primaryCurrency } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: (transaction?.type ?? 'expense') as TxType,
    amount: transaction?.amount ? String(transaction.amount) : '',
    category: transaction?.category ?? '',
    description: transaction?.description ?? '',
    date: transaction?.date ? format(new Date(transaction.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    isRecurring: transaction?.isRecurring ?? false,
    // null = not chosen yet, so a new transaction falls back to the default account below
    accountId: (transaction ? transaction.accountId ?? UNASSIGNED : null) as string | null,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dateInputRef = useRef<HTMLInputElement>(null)

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts])

  // Pre-fill the account dropdown with the user's default account (or first debit
  // account), but only for brand-new transactions the user hasn't picked one for.
  const { defaultAccountId, ready: defaultReady } = useDefaultAccount()
  const accountId = form.accountId ?? defaultAccountId
  // Still loading and untouched: the server will apply the default on save
  const accountPending = form.accountId === null && !defaultReady
  const currency = activeAccounts.find((a) => a._id === accountId)?.currency ?? primaryCurrency

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = 'Enter a valid positive amount'
    if (!form.category) e.category = 'Category is required'
    if (!form.date) e.date = 'Date is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const url = transaction ? `/api/transactions/${transaction._id}` : '/api/transactions'
      const method = transaction ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          accountId: accountIdForSubmit(form.accountId, defaultAccountId, defaultReady),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast(data.error ?? 'Failed to save transaction', 'error')
      } else {
        toast(transaction ? 'Transaction updated' : 'Transaction added', 'success')
        onSuccess()
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === form.type || c.type === 'both' || form.type === 'savings'),
    [categories, form.type]
  )

  const accountOptions = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...activeAccounts.map((a) => ({ value: a._id, label: a.name })),
  ]

  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const dateChoice: DateChoice = form.date === today ? 'today' : form.date === yesterday ? 'yesterday' : 'other'
  const dateOptions: SegmentOption<DateChoice>[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    {
      value: 'other',
      icon: CalendarDays,
      label: dateChoice === 'other' && form.date ? format(new Date(`${form.date}T00:00:00`), 'MMM d') : undefined,
      ariaLabel: 'Pick a date',
    },
  ]
  const pickDate = (choice: DateChoice) => {
    if (choice === 'today') setForm({ ...form, date: today })
    else if (choice === 'yesterday') setForm({ ...form, date: yesterday })
    else {
      try {
        dateInputRef.current?.showPicker()
      } catch {
        dateInputRef.current?.focus()
      }
    }
  }

  const amountNumber = Number(form.amount)
  const verb = transaction ? 'Update' : 'Add'
  const submitLabel =
    form.amount && amountNumber > 0
      ? `${verb} ${form.type} · ${moneyLabel(amountNumber, currency)}`
      : `${verb} ${form.type}`

  return (
    <FormModalLayout
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} className={formStyles.money}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <MicrophoneButton
        variant="prompt"
        currency={currency}
        onFill={(data) =>
          setForm((prev) => ({
            ...prev,
            ...(data.type && { type: data.type, category: '' }),
            ...(data.amount !== undefined && { amount: String(data.amount) }),
            ...(data.category && { category: data.category }),
            ...(data.description && { description: data.description }),
          }))
        }
      />

      <Segmented
        ariaLabel="Type"
        options={TYPE_OPTIONS}
        value={form.type}
        onChange={(type) => setForm({ ...form, type, category: '' })}
      />

      <AmountField
        id="tx-amount"
        label="Amount"
        value={form.amount}
        onChange={(amount) => setForm({ ...form, amount })}
        currency={currency}
        error={errors.amount}
        autoFocus
      />

      <CategoryChips
        categories={filteredCategories}
        value={form.category}
        onChange={(category) => setForm({ ...form, category })}
        error={errors.category}
      />

      <div className={formStyles.twoCol}>
        <Select
          tone="token"
          label="Account"
          value={accountId}
          onValueChange={(v) => setForm({ ...form, accountId: v })}
          options={accountOptions}
          placeholder={accountPending ? 'Default account' : 'Unassigned'}
        />
        <Field label="Date" error={errors.date}>
          <div style={{ position: 'relative' }}>
            <Segmented ariaLabel="Date" options={dateOptions} value={dateChoice} onChange={pickDate} />
            <input
            ref={dateInputRef}
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            tabIndex={-1}
            aria-hidden="true"
              style={{ position: 'absolute', right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />
          </div>
        </Field>
      </div>

      <Input
        id="tx-note"
        label="Note (optional)"
        placeholder="What was this for?"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      <ToggleRow
        title="Repeats every month"
        sub="For rent, Netflix, load promos"
        checked={form.isRecurring}
        onChange={(isRecurring) => setForm({ ...form, isRecurring })}
      />
    </FormModalLayout>
  )
}
