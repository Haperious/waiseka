"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { ArrowDown } from "lucide-react"
import Input from "@/components/ui/Input"
import Button from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { useCurrency } from "@/context/CurrencyContext"
import { Account } from "@/hooks/useAccounts"
import { AccountCard } from "@/components/forms/AccountCard"
import { AmountField, Chip, FormModalLayout, moneyLabel } from "@/components/forms/FormParts"
import formStyles from "@/components/forms/forms.module.css"

interface TransferFormProps {
  accounts: Account[]
  onSuccess: () => void
  onCancel: () => void
  /** Pre-selects and locks the destination account (used by the credit card payment flow). */
  lockedToAccountId?: string
}

/** Transfer / pay-card form. Render inside <Modal variant="form">. */
export default function TransferForm({ accounts, onSuccess, onCancel, lockedToAccountId }: TransferFormProps) {
  const { toast } = useToast()
  const { currency: primaryCurrency } = useCurrency()
  const [loading, setLoading] = useState(false)

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts])

  const [form, setForm] = useState({
    fromAccountId: "",
    toAccountId: lockedToAccountId ?? "",
    amount: "",
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
  const willOverpay = isCardPayment && form.amount !== "" && Number(form.amount) > outstanding
  const currency = fromAccount?.currency ?? toAccount?.currency ?? primaryCurrency

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.fromAccountId) e.fromAccountId = "Select a source account"
    if (!form.toAccountId) e.toAccountId = "Select a destination account"
    if (form.fromAccountId && form.toAccountId && form.fromAccountId === form.toAccountId)
      e.toAccountId = "Source and destination must differ"
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = "Enter a valid positive amount"
    if (currencyMismatch) e.toAccountId = "Both accounts must use the same currency"
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
        toast(data.error ?? "Failed to record transfer", "error")
        return
      }
      if (data.overpayment) {
        toast(
          "Transfer saved. Payment exceeds the outstanding balance - the card now shows a credit balance.",
          "success",
        )
      } else {
        toast("Transfer recorded", "success")
      }
      onSuccess()
    } catch {
      toast("Something went wrong", "error")
    } finally {
      setLoading(false)
    }
  }

  // Card payment shortcuts. Amounts are kept to 2 decimals like typed input.
  const fullAmount = outstanding > 0 ? String(Math.round(outstanding * 100) / 100) : ""
  const halfValue = Math.round((outstanding / 2) * 100) / 100
  const halfAmount = outstanding > 0 ? String(halfValue) : ""
  const amountNumber = Number(form.amount)
  const verb = isCardPayment ? "Pay card" : "Transfer"
  const submitLabel = form.amount && amountNumber > 0 ? `${verb} · ${moneyLabel(amountNumber, currency)}` : verb
  const pairError = errors.fromAccountId ?? errors.toAccountId

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
      <div className={formStyles.field}>
        <div className={formStyles.transferPair}>
          <AccountCard
            eyebrow="From"
            position="top"
            value={form.fromAccountId}
            options={fromOptions}
            accounts={activeAccounts}
            placeholder="Choose source account"
            invalid={!!errors.fromAccountId}
            onChange={(v) =>
              setForm({ ...form, fromAccountId: v, toAccountId: v === form.toAccountId ? "" : form.toAccountId })
            }
          />
          <span className={formStyles.seamBadge} aria-hidden="true">
            <ArrowDown size={15} />
          </span>
          <AccountCard
            eyebrow="To"
            position="bottom"
            value={form.toAccountId}
            options={toOptions}
            accounts={activeAccounts}
            placeholder="Choose destination account"
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
          label="Amount"
          value={form.amount}
          onChange={(amount) => setForm({ ...form, amount })}
          currency={currency}
          error={errors.amount}
        />
        {isCardPayment && outstanding > 0 && (
          <div className={formStyles.chips}>
            <Chip selected={form.amount === fullAmount} onClick={() => setForm({ ...form, amount: fullAmount })}>
              Pay full balance
            </Chip>
            <Chip selected={form.amount === halfAmount} onClick={() => setForm({ ...form, amount: halfAmount })}>
              Half · {moneyLabel(halfValue, currency)}
            </Chip>
          </div>
        )}
      </div>

      {willOverpay && (
        <div className={formStyles.warningBlock} role="status">
          This is more than the outstanding balance. The card will show a credit balance after this payment.
        </div>
      )}
      {countsAsSavings && (
        <span className={formStyles.hint}>This transfer will count toward your total savings and health score.</span>
      )}

      <div className={formStyles.twoCol}>
        <Input
          id="transfer-note"
          label="Note (optional)"
          placeholder="e.g. Move savings, pay card"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Input
          id="transfer-date"
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
      </div>
    </FormModalLayout>
  )
}
