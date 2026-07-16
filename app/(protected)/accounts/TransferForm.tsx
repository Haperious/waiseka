'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useCurrency } from '@/context/CurrencyContext'
import { Account } from '@/hooks/useAccounts'

interface TransferFormProps {
  accounts: Account[]
  onSuccess: () => void
  onCancel: () => void
  /** Pre-selects and locks the destination account (used by the credit card payment flow). */
  lockedToAccountId?: string
}

export default function TransferForm({ accounts, onSuccess, onCancel, lockedToAccountId }: TransferFormProps) {
  const { toast } = useToast()
  const { formatAmount } = useCurrency()
  const [loading, setLoading] = useState(false)

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts])

  const [form, setForm] = useState({
    fromAccountId: '',
    toAccountId: lockedToAccountId ?? '',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fromAccount = activeAccounts.find((a) => a._id === form.fromAccountId)
  const toAccount = activeAccounts.find((a) => a._id === form.toAccountId)
  const lockedToAccount = lockedToAccountId ? activeAccounts.find((a) => a._id === lockedToAccountId) : undefined

  // Cross-currency transfers are rejected server-side, so constrain the pickers to
  // matching currencies. When the destination is locked (card payment), filter the
  // source list to the card's currency; otherwise filter destinations to the source's.
  const fromOptions = activeAccounts
    .filter((a) => a._id !== form.toAccountId && (!lockedToAccount || a.currency === lockedToAccount.currency))
    .map((a) => ({ value: a._id, label: `${a.name} (${a.currency})` }))
  const toOptions = activeAccounts
    .filter((a) => a._id !== form.fromAccountId && (!fromAccount || a.currency === fromAccount.currency))
    .map((a) => ({ value: a._id, label: `${a.name} (${a.currency})` }))

  const currencyMismatch = fromAccount && toAccount && fromAccount.currency !== toAccount.currency
  const isCardPayment = toAccount?.type === 'credit'
  const outstanding = toAccount?.outstandingBalance ?? 0
  const willOverpay = isCardPayment && form.amount !== '' && Number(form.amount) > outstanding

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.fromAccountId) e.fromAccountId = 'Select a source account'
    if (!form.toAccountId) e.toAccountId = 'Select a destination account'
    if (form.fromAccountId && form.toAccountId && form.fromAccountId === form.toAccountId)
      e.toAccountId = 'Source and destination must differ'
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = 'Enter a valid positive amount'
    if (currencyMismatch) e.toAccountId = 'Both accounts must use the same currency'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId: form.fromAccountId,
          toAccountId: form.toAccountId,
          amount: Number(form.amount),
          description: form.description || undefined,
          date: form.date,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error ?? 'Failed to record transfer', 'error')
        return
      }
      if (data.overpayment) {
        toast('Transfer saved. Payment exceeds the outstanding balance — the card now shows a credit balance.', 'success')
      } else {
        toast('Transfer recorded', 'success')
      }
      onSuccess()
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="From"
        value={form.fromAccountId}
        onValueChange={(v) => setForm({ ...form, fromAccountId: v, toAccountId: v === form.toAccountId ? '' : form.toAccountId })}
        options={fromOptions}
        placeholder="Source account"
        error={errors.fromAccountId}
      />
      <Select
        label="To"
        value={form.toAccountId}
        onValueChange={(v) => setForm({ ...form, toAccountId: v })}
        options={toOptions}
        placeholder="Destination account"
        error={errors.toAccountId}
        disabled={!!lockedToAccountId}
      />
      <Input
        label="Amount"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
        error={errors.amount}
      />

      {isCardPayment && (
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0 }}>
          Outstanding on {toAccount?.name}: <strong style={{ color: 'var(--color-text-primary)' }}>{formatAmount(outstanding)}</strong>
        </p>
      )}
      {willOverpay && (
        <p style={{
          fontSize: '0.78rem', color: 'var(--color-warning)',
          padding: '8px 12px', borderRadius: 8, margin: 0,
          backgroundColor: 'var(--color-warning-bg)',
        }}>
          This is more than the outstanding balance. The card will show a credit balance after this payment.
        </p>
      )}

      <Input
        label="Description (optional)"
        placeholder="e.g. Move savings, pay card"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <Input
        label="Date"
        type="date"
        value={form.date}
        onChange={(e) => setForm({ ...form, date: e.target.value })}
      />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={loading}>
          {isCardPayment ? 'Pay Card' : 'Transfer'}
        </Button>
      </div>
    </form>
  )
}
