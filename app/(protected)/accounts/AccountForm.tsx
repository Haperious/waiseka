'use client'

import { useState } from 'react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { TranslationKey } from '@/lib/translations'
import { Account } from '@/hooks/useAccounts'

const TYPE_KEYS: Record<Account['type'], TranslationKey> = {
  debit: 'account.typeDebit',
  credit: 'account.typeCredit',
  savings: 'account.typeSavings',
  time_deposit: 'account.typeTimeDeposit',
  cash: 'account.typeCash',
  e_wallet: 'account.typeEWallet',
}

interface AccountFormProps {
  account?: Account
  onSuccess: () => void
  onCancel: () => void
  /** Called when the server rejects creation due to the free-tier account cap. */
  onCapHit?: () => void
}

export default function AccountForm({ account, onSuccess, onCancel, onCapHit }: AccountFormProps) {
  const { toast } = useToast()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: account?.name ?? '',
    institution: account?.institution ?? '',
    type: account?.type ?? 'debit',
    openingBalance: account?.openingBalance != null ? String(account.openingBalance) : '0',
    creditLimit: account?.creditLimit != null ? String(account.creditLimit) : '',
    dueDay: account?.dueDay != null ? String(account.dueDay) : '',
    lowBalanceThreshold: account?.lowBalanceThreshold != null ? String(account.lowBalanceThreshold) : '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const typeOptions = (Object.keys(TYPE_KEYS) as Account['type'][]).map((value) => ({
    value,
    label: t(TYPE_KEYS[value]),
  }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (form.openingBalance !== '' && isNaN(Number(form.openingBalance)))
      e.openingBalance = 'Enter a valid amount'
    if (form.type === 'credit' && form.creditLimit && (isNaN(Number(form.creditLimit)) || Number(form.creditLimit) <= 0))
      e.creditLimit = 'Enter a valid credit limit'
    if (form.type === 'credit' && form.dueDay) {
      const d = Number(form.dueDay)
      if (!Number.isInteger(d) || d < 1 || d > 31) e.dueDay = 'Enter a day between 1 and 31'
    }
    if (form.type !== 'credit' && form.lowBalanceThreshold && (isNaN(Number(form.lowBalanceThreshold)) || Number(form.lowBalanceThreshold) < 0))
      e.lowBalanceThreshold = 'Enter a valid amount'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const url = account ? `/api/accounts/${account._id}` : '/api/accounts'
      const method = account ? 'PUT' : 'POST'
      const payload: Record<string, unknown> = {
        name: form.name,
        institution: form.institution || undefined,
        type: form.type,
        openingBalance: form.openingBalance === '' ? 0 : Number(form.openingBalance),
      }
      if (form.type === 'credit') {
        payload.creditLimit = form.creditLimit ? Number(form.creditLimit) : null
        payload.dueDay = form.dueDay ? Number(form.dueDay) : null
        payload.lowBalanceThreshold = null
      } else {
        payload.creditLimit = null
        payload.dueDay = null
        payload.lowBalanceThreshold = form.lowBalanceThreshold ? Number(form.lowBalanceThreshold) : null
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 403 && onCapHit) {
          onCancel()
          onCapHit()
        } else {
          toast(data.error ?? 'Failed to save account', 'error')
        }
      } else {
        toast(account ? 'Account updated' : 'Account added', 'success')
        onSuccess()
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Account Name"
        placeholder="e.g. BDO, GCash, Cash on Hand"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        error={errors.name}
      />
      <Select
        label="Type"
        value={form.type}
        onValueChange={(v) => setForm({ ...form, type: v as Account['type'] })}
        options={typeOptions}
      />
      <Input
        label="Institution (optional)"
        placeholder="e.g. Banco de Oro"
        value={form.institution}
        onChange={(e) => setForm({ ...form, institution: e.target.value })}
      />
      <Input
        label="Opening Balance"
        type="number"
        step="0.01"
        placeholder="0.00"
        value={form.openingBalance}
        onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
        error={errors.openingBalance}
      />
      {form.type === 'credit' && (
        <>
          <Input
            label="Credit Limit"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.creditLimit}
            onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
            error={errors.creditLimit}
          />
          <Input
            label="Payment Due Day (optional)"
            type="number"
            min="1"
            max="31"
            placeholder="e.g. 15"
            value={form.dueDay}
            onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
            error={errors.dueDay}
          />
        </>
      )}
      {form.type !== 'credit' && (
        <Input
          label="Low-balance alert (optional)"
          type="number"
          step="0.01"
          min="0"
          placeholder="Notify me when balance drops below this"
          value={form.lowBalanceThreshold}
          onChange={(e) => setForm({ ...form, lowBalanceThreshold: e.target.value })}
          error={errors.lowBalanceThreshold}
        />
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={loading}>
          {account ? 'Update' : 'Add'} Account
        </Button>
      </div>
    </form>
  )
}
