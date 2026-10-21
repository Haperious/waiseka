"use client"

import { useState, useMemo, useEffect } from "react"
import { format } from "date-fns"
import { ArrowDown } from "lucide-react"
import Input from "@/components/ui/Input"
import Button from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { useCurrency } from "@/context/CurrencyContext"
import { useLanguage } from "@/context/LanguageContext"
import { Account } from "@/hooks/useAccounts"
import { AccountCard } from "@/components/forms/AccountCard"
import { AmountField, Chip, FormModalLayout, moneyLabel } from "@/components/forms/FormParts"
import formStyles from "@/components/forms/forms.module.css"
import SimilarEntryNote from "@/components/forms/SimilarEntryNote"
import { useSimilarEntries } from "@/hooks/useSimilarEntries"

interface TransferFormProps {
  accounts: Account[]
  onSuccess: () => void
  onCancel: () => void
  /** Pre-selects and locks the destination account (used by the credit card payment flow). */
  lockedToAccountId?: string
  /** Called when the destination switches between a card (a payment) and anything else, so the modal title can follow. */
  onCardPaymentChange?: (isCardPayment: boolean) => void
  /** Pre-fills the form, e.g. from a planned transfer that's due. Still editable. */
  initial?: { fromAccountId?: string; toAccountId?: string; amount?: number }
}

/** Transfer / pay-card form. Render inside <Modal variant="form">. */
export default function TransferForm({ accounts, onSuccess, onCancel, lockedToAccountId, onCardPaymentChange, initial }: TransferFormProps) {
  const { toast } = useToast()
  const { t } = useLanguage()
  const { currency: primaryCurrency } = useCurrency()
  const [loading, setLoading] = useState(false)

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts])

  const [form, setForm] = useState({
    fromAccountId: initial?.fromAccountId ?? "",
    toAccountId: lockedToAccountId ?? initial?.toAccountId ?? "",
    amount: initial?.amount != null ? String(initial.amount) : "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fromAccount = activeAccounts.find((a) => a._id === form.fromAccountId)
  const toAccount = activeAccounts.find((a) => a._id === form.toAccountId)
  const lockedToAccount = lockedToAccountId ? activeAccounts.find((a) => a._id === lockedToAccountId) : undefined

  // Cross-currency transfers are rejected server-side, so constrain the pickers to
  // matching currencies. When the destination is locked (card payment), filter the
  // source list to the card's currency; otherwise filter destinations to the source's.
  const fromOptions = activeAccounts.filter(
    (a) => a._id !== form.toAccountId && (!lockedToAccount || a.currency === lockedToAccount.currency)
  )
  const toOptions = activeAccounts.filter(
    (a) => a._id !== form.fromAccountId && (!fromAccount || a.currency === fromAccount.currency)
  )

  const currencyMismatch = fromAccount && toAccount && fromAccount.currency !== toAccount.currency
  const isCardPayment = toAccount?.type === "credit"
  const countsAsSavings = toAccount?.type === "savings" || toAccount?.type === "time_deposit"
  const outstanding = toAccount?.outstandingBalance ?? 0
  useEffect(() => {
    onCardPaymentChange?.(isCardPayment)
  }, [isCardPayment, onCardPaymentChange])
  const willOverpay = isCardPayment && form.amount !== "" && Number(form.amount) > outstanding
  const currency = fromAccount?.currency ?? toAccount?.currency ?? primaryCurrency

  // Soft checks - none of them block saving
  const amountValue = Number(form.amount)
  const amountValid = form.amount !== "" && Number.isFinite(amountValue) && amountValue > 0
  const similar = useSimilarEntries(
    amountValid && form.fromAccountId && form.toAccountId && form.date
      ? { type: "transfer", amount: amountValue, date: form.date, fromAccountId: form.fromAccountId, toAccountId: form.toAccountId }
      : null
  )
  // Moving more than WaiseKa shows usually means an entry is missing on the source side
  const fromBalance = fromAccount && fromAccount.type !== "credit" ? fromAccount.computedBalance : undefined
  const overdraws = amountValid && fromBalance != null && amountValue > fromBalance
  // Before one side's opening date, only the other side's balance moves
  const beforeOpeningAccount = [fromAccount, toAccount].find(
    (a) => a?.openingBalanceDate && form.date && form.date < a.openingBalanceDate.slice(0, 10)
  )

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.fromAccountId) e.fromAccountId = t('transferForm.errFrom')
    if (!form.toAccountId) e.toAccountId = t('transferForm.errTo')
    if (form.fromAccountId && form.toAccountId && form.fromAccountId === form.toAccountId)
      e.toAccountId = t('transferForm.errSame')
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = t('form.errAmount')
    if (currencyMismatch) e.toAccountId = t('transferForm.errCurrency')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        toast(data.error ?? t('transferForm.failed'), "error")
        return
      }
      if (data.overpayment) {
        toast(t('transferForm.overpaidToast'), "success")
      } else {
        toast(t('transferForm.recorded'), "success")
      }
      onSuccess()
    } catch {
      toast(t('common.genericError'), "error")
    } finally {
      setLoading(false)
    }
  }

  // Card payment shortcuts. Amounts are kept to 2 decimals like typed input.
  const fullAmount = outstanding > 0 ? String(Math.round(outstanding * 100) / 100) : ""
  const halfValue = Math.round((outstanding / 2) * 100) / 100
  const halfAmount = outstanding > 0 ? String(halfValue) : ""
  const amountNumber = Number(form.amount)
  const verb = isCardPayment ? t('transferForm.payCard') : t('common.transfer')
  const submitLabel = form.amount && amountNumber > 0 ? `${verb} · ${moneyLabel(amountNumber, currency)}` : verb
  const pairError = errors.fromAccountId ?? errors.toAccountId

  return (
    <FormModalLayout
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading} className={formStyles.money}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className={formStyles.field}>
        <div className={formStyles.transferPair}>
          <AccountCard
            eyebrow={t('transferForm.from')}
            position="top"
            value={form.fromAccountId}
            options={fromOptions}
            accounts={activeAccounts}
            placeholder={t('transferForm.chooseFrom')}
            invalid={!!errors.fromAccountId}
            onChange={(v) =>
              setForm({ ...form, fromAccountId: v, toAccountId: v === form.toAccountId ? "" : form.toAccountId })
            }
          />
          <span className={formStyles.seamBadge} aria-hidden="true">
            <ArrowDown size={15} />
          </span>
          <AccountCard
            eyebrow={t('transferForm.to')}
            position="bottom"
            value={form.toAccountId}
            options={toOptions}
            accounts={activeAccounts}
            placeholder={t('transferForm.chooseTo')}
            invalid={!!errors.toAccountId}
            locked={!!lockedToAccountId}
            onChange={(v) => setForm({ ...form, toAccountId: v })}
          />
        </div>
        {pairError && <span className={formStyles.errorText}>{pairError}</span>}
      </div>

      <div className={formStyles.field}>
        <AmountField
          id="transfer-amount"
          label={t('common.amount')}
          value={form.amount}
          onChange={(amount) => setForm({ ...form, amount })}
          currency={currency}
          error={errors.amount}
        />
        {isCardPayment && outstanding > 0 && (
          <div className={formStyles.chips}>
            <Chip selected={form.amount === fullAmount} onClick={() => setForm({ ...form, amount: fullAmount })}>
              {t('transferForm.payFull')}
            </Chip>
            <Chip selected={form.amount === halfAmount} onClick={() => setForm({ ...form, amount: halfAmount })}>
              {t('transferForm.half').replace('{amount}', moneyLabel(halfValue, currency))}
            </Chip>
          </div>
        )}
      </div>

      {willOverpay && (
        <div className={formStyles.warningBlock} role="status">
          {t('transferForm.overpayWarning')}
        </div>
      )}
      {overdraws && fromAccount && (
        <div className={formStyles.warningBlock} role="status">
          {t('transferForm.overdraw')
            .replace('{account}', fromAccount.name)
            .replace('{amount}', moneyLabel(fromBalance ?? 0, currency))}
        </div>
      )}
      <SimilarEntryNote matches={similar} currency={currency} />
      {countsAsSavings && (
        <span className={formStyles.hint}>{t('transferForm.savingsNote')}</span>
      )}
      {beforeOpeningAccount && (
        <span className={formStyles.hint}>
          {t('transferForm.beforeOpening').replace('{account}', beforeOpeningAccount.name)}
        </span>
      )}

      <div className={formStyles.twoCol}>
        <Input
          id="transfer-note"
          label={t('form.note')}
          placeholder={t('transferForm.notePlaceholder')}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Input
          id="transfer-date"
          label={t('common.date')}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
      </div>
    </FormModalLayout>
  )
}
