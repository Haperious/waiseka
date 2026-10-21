'use client'

import { useState } from 'react'
import { format } from 'date-fns'
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
    // New accounts: today. Older accounts made before this field: blank (counts every entry).
    // slice keeps the server's UTC day, so the shown date is the one the balance math uses.
    openingBalanceDate: account ? (account.openingBalanceDate?.slice(0, 10) ?? '') : format(new Date(), 'yyyy-MM-dd'),
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
    if (!form.name.trim()) e.name = t('accountForm.errName')
    if (form.openingBalance !== '' && isNaN(Number(form.openingBalance)))
      e.openingBalance = t('accountForm.errAmount')
    if (form.type === 'credit' && form.creditLimit && (isNaN(Number(form.creditLimit)) || Number(form.creditLimit) <= 0))
      e.creditLimit = t('accountForm.errLimit')
    if (form.type === 'credit' && form.dueDay) {
      const d = Number(form.dueDay)
      if (!Number.isInteger(d) || d < 1 || d > 31) e.dueDay = t('accountForm.errDueDay')
    }
    if (form.type !== 'credit' && form.lowBalanceThreshold && (isNaN(Number(form.lowBalanceThreshold)) || Number(form.lowBalanceThreshold) < 0))
      e.lowBalanceThreshold = t('accountForm.errAmount')
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
        openingBalanceDate: form.openingBalanceDate || null,
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
          toast(data.error ?? t('accountForm.failed'), 'error')
        }
      } else {
        toast(account ? t('accountForm.updated') : t('accountForm.added'), 'success')
        onSuccess()
      }
    } catch {
      toast(t('common.genericError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const openingBalanceInput = (
    <Input
      id="account-opening"
      // For cards this is what's owed when the card is added; it counts toward the outstanding balance
      label={form.type === 'credit' ? t('accountForm.balanceOwed') : t('accountForm.openingBalance')}
      type="number"
      step="0.01"
      placeholder="0.00"
      value={form.openingBalance}
      onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
      error={errors.openingBalance}
    />
  )

  const balanceAsOfInput = (
    <Field hint={account && !account.openingBalanceDate ? t('accountForm.balanceAsOfLegacyHint') : t('accountForm.balanceAsOfHint')}>
      <Input
        id="account-opening-date"
        label={t('accountForm.balanceAsOf')}
        type="date"
        max={format(new Date(), 'yyyy-MM-dd')}
        value={form.openingBalanceDate}
        onChange={(e) => setForm({ ...form, openingBalanceDate: e.target.value })}
      />
    </Field>
  )

  return (
    <FormModalLayout
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {account ? t('accountForm.update') : t('accountForm.add')}
          </Button>
        </>
      }
    >
      <Field label={t('common.type')}>
        <div className={formStyles.typeGrid} role="radiogroup" aria-label={t('common.type')}>
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
          label={t('accountForm.name')}
          placeholder={t('accountForm.namePlaceholder')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
        />
        <Input
          id="account-bank"
          label={t('accountForm.bank')}
          placeholder={t('accountForm.bankPlaceholder')}
          value={form.institution}
          onChange={(e) => setForm({ ...form, institution: e.target.value })}
        />
      </div>

      {!account && (
        <Field label={t('form.currency')} hint={t('accountForm.currencyHint')}>
          <Segmented
            ariaLabel={t('form.currency')}
            options={currencyOptions}
            value={form.currency}
            onChange={(currency) => setForm({ ...form, currency })}
          />
        </Field>
      )}

      {form.type === 'credit' ? (
        <div className={formStyles.paleBlock}>
          <span className={formStyles.eyebrow}>{t('accountForm.cardDetails')}</span>
          <div className={formStyles.threeCol}>
            {openingBalanceInput}
            <Input
              id="account-limit"
              label={t('accountForm.creditLimit')}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              error={errors.creditLimit}
            />
            <Field hint={errors.dueDay ? undefined : t('accountForm.dueDayHint')}>
              <Input
                id="account-due"
                label={t('accountForm.dueDay')}
                type="number"
                min="1"
                max="31"
                placeholder={t('accountForm.dueDayPlaceholder')}
                value={form.dueDay}
                onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                error={errors.dueDay}
              />
            </Field>
          </div>
          {balanceAsOfInput}
        </div>
      ) : (
        <div className={formStyles.paleBlock}>
          <span className={formStyles.eyebrow}>{t('accountForm.balance')}</span>
          <div className={formStyles.twoCol}>
            {openingBalanceInput}
            <Input
              id="account-alert"
              label={t('accountForm.lowAlert')}
              type="number"
              step="0.01"
              min="0"
              placeholder={t('accountForm.lowAlertPlaceholder')}
              value={form.lowBalanceThreshold}
              onChange={(e) => setForm({ ...form, lowBalanceThreshold: e.target.value })}
              error={errors.lowBalanceThreshold}
            />
          </div>
          {balanceAsOfInput}
        </div>
      )}
    </FormModalLayout>
  )
}
