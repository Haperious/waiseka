"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, CornerDownLeft } from "lucide-react"
import { useAccounts } from "@/hooks/useAccounts"
import { useVoiceKeywords } from "@/hooks/useVoiceKeywords"
import { useCurrency } from "@/context/CurrencyContext"
import { parseSpeechToTransaction } from "@/lib/parseSpeechToTransaction"
import { emitTransactionSaved } from "@/lib/transactionEvents"
import { useToast } from "@/components/ui/Toast"

interface SearchResult {
  _id: string
  amount: number
  type: string
  category: string
  description?: string
  date: string
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { formatAmount } = useCurrency()
  const { accounts } = useAccounts()
  const { keywords } = useVoiceKeywords()

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      const t = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const parsed = useMemo(() => (query.trim() ? parseSpeechToTransaction(query, keywords) : null), [query, keywords])

  const matchedAccount = useMemo(() => {
    if (!query.trim()) return null
    const lower = query.toLowerCase()
    return accounts.find((a) => lower.includes(a.name.toLowerCase())) ?? null
  }, [query, accounts])

  const isCapture = Boolean(parsed?.amount && parsed?.type)

  // Debounced search - skip while the input reads as a capture command
  useEffect(() => {
    if (!open || isCapture || !query.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/transactions?search=${encodeURIComponent(query.trim())}&limit=6`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setResults(Array.isArray(data?.transactions) ? data.transactions : []))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [query, open, isCapture])

  const handleCommit = async () => {
    if (!parsed?.amount || !parsed?.type || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsed.amount,
          type: parsed.type,
          category: parsed.category ?? "Other",
          description: parsed.description,
          date: new Date().toISOString(),
          accountId: matchedAccount?._id ?? null,
        }),
      })
      if (!res.ok) throw new Error("Failed to add transaction")
      emitTransactionSaved()
      toast("Transaction added")
      onClose()
    } catch {
      toast("Could not add transaction", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return
    if (isCapture) {
      handleCommit()
    } else if (query.trim()) {
      router.push(`/transactions?search=${encodeURIComponent(query.trim())}`)
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 hidden lg:flex items-start justify-center pt-[12vh]">
      <div
        onClick={onClose}
        className="absolute inset-0"
        style={{ backgroundColor: "var(--color-backdrop)", backdropFilter: "blur(4px)" }}
      />
      <div
        style={{
          position: "relative",
          width: 560,
          maxHeight: "60vh",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <Search style={{ width: 16, height: 16, color: "var(--color-text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Search or add - try "grab 285 gcash"'
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "0.9rem",
              color: "var(--color-text-primary)",
            }}
          />
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 5,
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            ESC
          </span>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {isCapture && parsed ? (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <p
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                }}
              >
                Parsed transaction
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  borderRadius: 12,
                  backgroundColor: "var(--color-elevated)",
                  padding: "12px 14px",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {formatAmount(parsed.amount ?? 0)}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
                    {parsed.type} · {parsed.category ?? "Other"}
                    {matchedAccount ? ` · ${matchedAccount.name}` : ""}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.72rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <CornerDownLeft style={{ width: 12, height: 12 }} />
                  {saving ? "Saving…" : "Enter to add"}
                </div>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div style={{ padding: 8 }}>
              {results.map((r) => (
                <button
                  key={r._id}
                  onClick={() => {
                    router.push(`/transactions?search=${encodeURIComponent(r.description ?? r.category)}`)
                    onClose()
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "none",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  className="hover:bg-[var(--color-elevated)]"
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.description || r.category}
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>{r.category}</p>
                  </div>
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                      color:
                        r.type === "expense"
                          ? "var(--color-expense)"
                          : r.type === "income"
                            ? "var(--color-income)"
                            : "var(--color-savings)",
                    }}
                  >
                    {formatAmount(r.amount)}
                  </span>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <p style={{ padding: 20, fontSize: "0.82rem", color: "var(--color-text-muted)", textAlign: "center" }}>
              No matching transactions. Press Enter to search in Transactions.
            </p>
          ) : (
            <p style={{ padding: 20, fontSize: "0.82rem", color: "var(--color-text-muted)", textAlign: "center" }}>
              Search your transactions, or type an amount to log a new one.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
