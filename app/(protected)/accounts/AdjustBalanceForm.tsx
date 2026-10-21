"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ArrowRight } from "lucide-react"
import Input from "@/components/ui/Input"
import Button from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { useLanguage } from "@/context/LanguageContext"
import { formatAmount } from "@/lib/currency"
import type { Account } from "@/hooks/useAccounts"
import type { Transaction } from "@/hooks/useTransactions"
import { AmountField, FormModalLayout } from "@/components/forms/FormParts"
import formStyles from "@/components/forms/forms.module.css"
import AdjustGapHints from "./AdjustGapHints"

interface AdjustBalanceFormProps {
  account: Account
  /** Present when editing an existing adjustment. */
  adjustment?: Transaction | null
  onSuccess: () => void
  onCancel: () => void
  /** yyyy-MM-dd of a card statement to check: starts on that date with statement wording. */
  statementDate?: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * "Make WaiseKa match my bank": the user types the real balance (amount owed, for a card),
 * reviews the change, then confirms. The server works out and saves the difference.
 * Render inside <Modal variant="form">.
 */
export default function AdjustBalanceForm({ account, adjustment, onSuccess, onCancel, statementDate }: AdjustBalanceFormProps) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const isCredit = account.type === "credit"
  const isEdit = !!adjustment

  const [target, setTarget] = useState(
    adjustment?.adjustmentTarget != null ? String(adjustment.adjustmentTarget) : ""
  )
  const [date, setDate] = useState(
    adjustment ? format(new Date(adjustment.date), "yyyy-MM-dd") : statementDate ?? format(new Date(), "yyyy-MM-dd")
  )
  const [note, setNote] = useState(adjustment?.description ?? "")
  const [step, setStep] = useState<"enter" | "confirm">("enter")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  // WaiseKa's figure at the end of the chosen date (leaving out the adjustment being edited).
  // Results are tagged with the request they answer, so a stale one never shows for a new date.
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = `${date}|${reloadKey}`
  const [lookup, setLookup] = useState<{ key: string; balance: number | null; failed: boolean } | null>(null)
  const current = lookup?.key === requestKey ? lookup.balance : null
  const currentError = lookup?.key === requestKey && lookup.failed

  useEffect(() => {
    if (!date) return
    const controller = new AbortController()
    const params = new URLSearchParams({ accountId: account._id, date })
    if (adjustment) params.set("excludeId", adjustment._id)
    const key = `${date}|${reloadKey}`
    fetch(`/api/adjustments?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (typeof data.balance !== "number") throw new Error()
        setLookup({ key, balance: data.balance, failed: false })
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setLookup({ key, balance: null, failed: true })
      })
    return () => controller.abort()
  }, [account._id, adjustment, date, reloadKey])

  const fmt = (v: number) => formatAmount(v, account.currency)
  // The server's UTC day; adjustments can't go before the opening balance's date
  const openingDay = account.openingBalanceDate?.slice(0, 10) ?? null
  const targetNumber = Number(target)
  const targetValid = target !== "" && target !== "-" && Number.isFinite(targetNumber)
  const delta = targetValid && current != null ? round2(targetNumber - current) : null

  const review = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetValid) return setError(t("accountForm.errAmount"))
    if (!date) return setError(t("bulkForm.selectDate"))
    if (openingDay && date < openingDay) {
      return setError(t("adjust.beforeOpening").replace("{date}", format(new Date(`${openingDay}T12:00:00`), "MMM d, yyyy")))
    }
    if (delta === 0) {
      // Already matching is good news: save it as a check instead of turning the user away
      if (isEdit || current == null) return setError(t("adjust.matches"))
      return void saveMatch(current)
    }
    if (delta == null) return
    setError("")
    setStep("confirm")
  }

  const saveMatch = async (balance: number) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/accounts/${account._id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, balance }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? t("verify.failed"), "error")
        setReloadKey((k) => k + 1)
        return
      }
      toast(t("adjust.matchedSaved").replace("{account}", account.name), "success")
      onSuccess()
    } catch {
      toast(t("common.genericError"), "error")
    } finally {
      setSaving(false)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { targetBalance: round2(targetNumber), date, note }
      const res = await fetch(isEdit ? `/api/adjustments/${adjustment!._id}` : "/api/adjustments", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? payload : { ...payload, accountId: account._id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(data.error ?? t("adjust.failed"), "error")
        // The balance may have moved since the review (e.g. another tab) - start over
        setStep("enter")
        setReloadKey((k) => k + 1)
        return
      }
      toast(t("adjust.saved"), "success")
      onSuccess()
    } catch {
      toast(t("common.genericError"), "error")
    } finally {
      setSaving(false)
    }
  }

  if (step === "confirm" && delta != null && current != null) {
    const body = (isCredit ? t("adjust.confirmBodyCredit") : t("adjust.confirmBody"))
      .replace("{account}", account.name)
      .replace("{from}", fmt(current))
      .replace("{to}", fmt(targetNumber))
    return (
      <FormModalLayout
        onSubmit={save}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setStep("enter")} disabled={saving}>
              {t("adjust.back")}
            </Button>
            <Button type="submit" loading={saving}>
              {t("adjust.confirm")}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "0.9rem", color: "var(--color-text-primary)", lineHeight: 1.5, margin: 0 }}>{body}</p>

        <div className={formStyles.paleBlock}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums", textDecoration: "line-through" }}>
              {fmt(current)}
            </span>
            <ArrowRight size={16} style={{ color: "var(--color-text-muted)" }} aria-hidden="true" />
            <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {fmt(targetNumber)}
            </span>
          </div>
          <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
            {t("adjust.change")}:{" "}
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>
              {delta > 0 ? "+" : "−"}{fmt(Math.abs(delta))}
            </strong>
            {" · "}{format(new Date(`${date}T12:00:00`), "MMM d, yyyy")}
          </div>
        </div>

        <AdjustGapHints account={account} date={date} target={round2(targetNumber)} excludeId={adjustment?._id} />

        <div className={formStyles.warningBlock} role="alert">
          {t("adjust.confirmWarning")}
        </div>
        <span className={formStyles.hint}>{t("adjust.confirmNote")}</span>
      </FormModalLayout>
    )
  }

  return (
    <FormModalLayout
      onSubmit={review}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={current == null} loading={saving}>
            {t("adjust.review")}
          </Button>
        </>
      }
    >
      <span className={formStyles.hint} style={{ fontSize: "0.82rem" }}>
        {statementDate
          ? t("adjust.introStatement").replace("{date}", format(new Date(`${statementDate}T12:00:00`), "MMM d, yyyy"))
          : isCredit ? t("adjust.introCredit") : t("adjust.intro")}
      </span>

      <div className={formStyles.field}>
        <AmountField
          id="adjust-target"
          label={isCredit ? t("adjust.actualOwed") : t("adjust.actualBalance")}
          value={target}
          onChange={(v) => { setTarget(v); setError("") }}
          currency={account.currency}
          error={error || undefined}
          allowNegative
          autoFocus
        />
        <span className={formStyles.hint} aria-live="polite">
          {currentError ? (
            <>
              {t("adjust.loadFailed")}{" "}
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                style={{ background: "none", border: "none", padding: 0, color: "var(--color-accent)", fontWeight: 600, cursor: "pointer" }}
              >
                {t("adjust.retry")}
              </button>
            </>
          ) : current == null ? (
            t("adjust.checking")
          ) : (
            t("adjust.waisekaShows").replace("{amount}", fmt(current))
          )}
        </span>
      </div>

      <div className={formStyles.twoCol}>
        <Input
          id="adjust-note"
          label={t("form.note")}
          placeholder={t("adjust.notePlaceholder")}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        <Input
          id="adjust-date"
          label={t("common.date")}
          type="date"
          min={openingDay ?? undefined}
          value={date}
          onChange={(e) => { setDate(e.target.value); setError("") }}
        />
      </div>
    </FormModalLayout>
  )
}
