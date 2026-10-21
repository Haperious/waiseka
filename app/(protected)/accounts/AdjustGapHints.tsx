"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Lightbulb } from "lucide-react"
import { useLanguage } from "@/context/LanguageContext"
import { formatAmount } from "@/lib/currency"
import type { Account } from "@/hooks/useAccounts"
import type { GapHints, HintItem } from "@/lib/services/gapHints"

interface AdjustGapHintsProps {
  account: Account
  /** yyyy-MM-dd */
  date: string
  target: number
  /** Adjustment being edited, left out of the comparison. */
  excludeId?: string
}

const showDay = (day: string) => format(new Date(`${day}T12:00:00`), "MMM d")

/**
 * Likely causes of the gap, shown on the adjust confirm step. Shows nothing while loading,
 * on error, or when there's nothing to point at - it's a helper, never a blocker.
 */
export default function AdjustGapHints({ account, date, target, excludeId }: AdjustGapHintsProps) {
  const { t } = useLanguage()
  const requestKey = `${account._id}|${date}|${target}|${excludeId ?? ""}`
  const [result, setResult] = useState<{ key: string; since: string | null; hints: GapHints | null } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ accountId: account._id, date, target: String(target) })
    if (excludeId) params.set("excludeId", excludeId)
    fetch(`/api/adjustments/hints?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setResult({ key: requestKey, since: data.since ?? null, hints: data.hints ?? null }) })
      .catch(() => {})
    return () => controller.abort()
  }, [account._id, date, target, excludeId, requestKey])

  const hints = result?.key === requestKey ? result.hints : null
  if (!hints) return null

  const fmt = (v: number) => formatAmount(v, account.currency)
  const since = result?.since ? showDay(result.since) : ""
  const accountLink = (item: HintItem) => {
    const search = item.entry.description || item.entry.category || ""
    return `/transactions?${new URLSearchParams({ account: account._id, ...(search ? { search } : {}) })}`
  }

  const rows: { item: HintItem; note: string; href: string }[] = [
    ...hints.unlinked.items.map((item) => ({
      item, note: t("hints.unlinked"),
      href: `/transactions?${new URLSearchParams({ account: "unassigned", ...(item.entry.description ? { search: item.entry.description } : {}) })}`,
    })),
    ...hints.duplicates.items.map((item) => ({ item, note: t("hints.duplicate"), href: accountLink(item) })),
    ...hints.wrongType.items.map((item) => ({ item, note: t("hints.wrongType"), href: accountLink(item) })),
  ].sort((a, b) => Number(b.item.exact) - Number(a.item.exact))

  // Unlinked entries that don't match exactly are still worth one line
  const unlinkedOthers = hints.unlinked.count - hints.unlinked.items.length
  const showUnlinked = unlinkedOthers > 0
  const showBefore = hints.beforeOpening.count > 0
  if (rows.length === 0 && !showUnlinked && !showBefore) return null

  const chip = (
    <span style={{
      fontSize: "0.62rem", fontWeight: 700, padding: "1px 7px", borderRadius: 999,
      backgroundColor: "var(--color-income-bg)", color: "var(--color-income)", whiteSpace: "nowrap",
    }}>
      {t("hints.exact")}
    </span>
  )
  const linkStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "var(--color-accent)", flexShrink: 0 }

  return (
    <section
      aria-label={t("hints.title")}
      style={{
        display: "flex", flexDirection: "column", gap: 8,
        padding: "12px 14px", borderRadius: 12,
        border: "1px solid var(--color-border)", backgroundColor: "var(--color-card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-primary)" }}>
        <Lightbulb style={{ width: 14, height: 14, color: "var(--color-warning)" }} aria-hidden="true" />
        <strong style={{ fontSize: "0.82rem" }}>{t("hints.title")}</strong>
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.4 }}>{t("hints.intro")}</span>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(({ item, note, href }) => (
          <li key={`${note}-${item.entry._id}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--color-text-primary)" }}>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                  {item.entry.description || item.entry.category}
                </span>
                <span style={{ color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {showDay(item.entry.day)} · {fmt(item.entry.amount)}
                </span>
                {item.exact && chip}
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>{note}</span>
            </div>
            <Link href={href} style={linkStyle}>{t("hints.review")}</Link>
          </li>
        ))}

        {showUnlinked && (
          <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
            <span style={{ flex: 1 }}>
              {(unlinkedOthers === 1 ? t("hints.unlinkedCountOne") : t("hints.unlinkedCount").replace("{n}", String(unlinkedOthers)))
                .replace("{date}", since)}
            </span>
            <Link href="/transactions?account=unassigned" style={linkStyle}>{t("hints.review")}</Link>
          </li>
        )}

        {showBefore && (
          <li style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
            {hints.beforeOpening.exact && chip}
            <span style={{ flex: "1 1 200px" }}>
              {hints.beforeOpening.count === 1
                ? t("hints.beforeOpeningOne")
                : t("hints.beforeOpening").replace("{n}", String(hints.beforeOpening.count))}
            </span>
          </li>
        )}
      </ul>
    </section>
  )
}
