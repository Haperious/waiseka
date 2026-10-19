'use client'

import { useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { Account } from '@/hooks/useAccounts'
import { useCurrency } from '@/context/CurrencyContext'
import { getAllCurrencies, CurrencyCode } from '@/lib/currency'
import { Field, FormModalLayout, Segmented, type SegmentOption } from '@/components/forms/FormParts'
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_KEYS } from '@/components/forms/accountTypes'
import formStyles from '@/components/forms/forms.module.css'

interface AccountFormProps {
  account?: Account
  onSuccess: () => void
  onCancel: () => void
  /** Called when the server rejects creation due to the free-tier account cap. */
  onCapHit?: () => void
}

/** Add/edit account form. Render inside <Modal variant="form">. */
export default function AccountForm({ account, onSuccess, onCancel, onCapHit }: AccountFormProps) {
  const { toast } = useToast()
  const { t } = useLanguage()
  const { currency: primaryCurrency } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: account?.name ?? '',
    institution: account?.institution ?? '',
    type: account?.type ?? 'debit',
    // Only chosen on create - an account's currency is locked once it has transactions
    currency: primaryCurrency as CurrencyCode,
    openingBalance: account?.openingBalance != null ? String(account.openingBalance) : '0',
    creditLimit: account?.creditLimit != null ? String(account.creditLimit) : '',
    dueDay: account?.dueDay != null ? String(account.dueDay) : '',
    lowBalanceThreshold: account?.lowBalanceThreshold != null ? String(account.lowBalanceThreshold) : '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currencyOptions: SegmentOption<CurrencyCode>[] = getAllCurrencies().map((c) => ({
    value: c.code,
    label: `${c.flag} ${c.code}`,
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
      if (!account) payload.currency = form.currency
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

  const openingBalanceInput = (
    <Input
      id="account-opening"
      label="Opening balance"
      type="number"
      step="0.01"
      placeholder="0.00"
      value={form.openingBalance}
      onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
      error={errors.openingBalance}
    />
  )

  return (
    <FormModalLayout
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {account ? 'Update account' : 'Add account'}
          </Button>
        </>
      }
    >
      <Field label="Type">
        <div className={formStyles.typeGrid} role="radiogroup" aria-label="Type">
          {(Object.keys(ACCOUNT_TYPE_KEYS) as Account['type'][]).map((type) => {
            const Icon = ACCOUNT_TYPE_ICONS[type]
            const on = form.type === type
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={on}
                className={`${formStyles.typeTile} ${on ? formStyles.typeTileOn : ''}`}
                onClick={() => setForm({ ...form, type })}
              >
                <span className={formStyles.typeIcon}>
                  <Icon size={15} />
                </span>
                {t(ACCOUNT_TYPE_KEYS[type])}
              </button>
            )
          })}
        </div>
      </Field>

      <div className={formStyles.twoCol}>
        <Input
          id="account-name"
          label="Account name"
          placeholder="e.g. BDO, GCash, Cash on Hand"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
        />
        <Input
          id="account-bank"
          label="Bank (optional)"
          placeholder="e.g. Banco de Oro"
          value={form.institution}
          onChange={(e) => setForm({ ...form, institution: e.target.value })}
        />
      </div>

      {!account && (
        <Field label="Currency" hint="Currency locks once this account has transactions.">
          <Segmented
            ariaLabel="Currency"
            options={currencyOptions}
            value={form.currency}
            onChange={(currency) => setForm({ ...form, currency })}
          />
        </Field>
      )}

      {form.type === 'credit' ? (
        <div className={formStyles.paleBlock}>
          <span className={formStyles.eyebrow}>Credit card details</span>
          <div className={formStyles.threeCol}>
            {openingBalanceInput}
            <Input
              id="account-limit"
              label="Credit limit"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              error={errors.creditLimit}
            />
            <Field hint={errors.dueDay ? undefined : 'of each month'}>
              <Input
                id="account-due"
                label="Due day"
                type="number"
                min="1"
                max="31"
                placeholder="e.g. 15"
                value={form.dueDay}
                onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                error={errors.dueDay}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className={formStyles.paleBlock}>
          <span className={formStyles.eyebrow}>Balance</span>
          <div className={formStyles.twoCol}>
            {openingBalanceInput}
            <Input
              id="account-alert"
              label="Low-balance alert (optional)"
              type="number"
              step="0.01"
              min="0"
              placeholder="Alert me below…"
              value={form.lowBalanceThreshold}
              onChange={(e) => setForm({ ...form, lowBalanceThreshold: e.target.value })}
              error={errors.lowBalanceThreshold}
            />
          </div>
        </div>
      )}
    </FormModalLayout>
  )
}
