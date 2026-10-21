"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import Button from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { useLanguage } from "@/context/LanguageContext"
import { formatAmount } from "@/lib/currency"
import type { Account } from "@/hooks/useAccounts"
import { FormModalLayout } from "@/components/forms/FormParts"
import formStyles from "@/components/forms/forms.module.css"

interface VerifyBalanceFormProps {
  account: Account
  onVerified: () => void
  /** "No, fix it" - hands over to the adjust form. */
  onMismatch: () => void
  onCancel: () => void
}

/**
 * The quick balance check: "Does your bank show ₱X today?" Yes saves the check; No opens
 * the adjust form. Uses today's figure from /api/adjustments so it's exactly what the
 * server will compare against. Render inside <Modal variant="form">.
 */
export default function VerifyBalanceForm({ account, onVerified, onMismatch, onCancel }: VerifyBalanceFormProps) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const isCredit = account.type === "credit"
  const today = format(new Date(), "yyyy-MM-dd")

  const [reloadKey, setReloadKey] = useState(0)
  const [lookup, setLookup] = useState<{ key: number; balance: number | null; failed: boolean } | null>(null)
  const current = lookup?.key === reloadKey ? lookup.balance : null
  const failed = lookup?.key === reloadKey && lookup.failed
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const key = reloadKey
    fetch(`/api/adjustments?${new URLSearchParams({ accountId: account._id, date: today })}`, { signal: controller.signal })
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
  }, [account._id, today, reloadKey])

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (current == null) return
    setSaving(true)
    try {
      const res = await fetch(`/api/accounts/${account._id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, balance: current }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(data.error ?? t("verify.failed"), "error")
        // The balance moved since it was shown - show the new one
        setReloadKey((k) => k + 1)
        return
      }
      toast(t("verify.saved").replace("{account}", account.name), "success")
      onVerified()
    } catch {
      toast(t("common.genericError"), "error")
    } finally {
      setSaving(false)
    }
  }

  const amount = current != null ? formatAmount(current, account.currency) : "…"
  const question = (isCredit ? t("verify.questionCredit") : t("verify.question"))
    .replace("{amount}", amount)
    .replace("{account}", account.name)

  return (
    <FormModalLayout
      onSubmit={confirm}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onMismatch} disabled={saving}>
            {t("verify.no")}
          </Button>
          <Button type="submit" loading={saving} disabled={current == null}>
            {t("verify.yes")}
          </Button>
        </>
      }
    >
      {failed ? (
        <span className={formStyles.hint} role="alert">
          {t("adjust.loadFailed")}{" "}
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            style={{ background: "none", border: "none", padding: 0, color: "var(--color-accent)", fontWeight: 600, cursor: "pointer" }}
          >
            {t("adjust.retry")}
          </button>
        </span>
      ) : (
        <div className={formStyles.paleBlock} aria-live="polite">
          <p style={{ fontSize: "0.95rem", color: "var(--color-text-primary)", lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
            {current == null ? t("adjust.checking") : question}
          </p>
        </div>
      )}
      <span className={formStyles.hint}>{t("verify.why")}</span>
      <button
        type="button"
        onClick={onCancel}
        style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--color-text-muted)", fontSize: "0.8rem", cursor: "pointer" }}
      >
        {t("common.cancel")}
      </button>
    </FormModalLayout>
  )
}
