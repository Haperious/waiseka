"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { Camera, Mic, Square } from "lucide-react"
import { useCategories } from "@/hooks/useCategories"
import { useAccounts } from "@/hooks/useAccounts"
import { useCurrency } from "@/context/CurrencyContext"
import { useToast } from "@/components/ui/Toast"
import { useLanguage } from "@/context/LanguageContext"
import { useSpeechToText } from "@/hooks/useSpeechToText"
import { useVoiceKeywords } from "@/hooks/useVoiceKeywords"
import { parseSpeechToTransaction, ParsedTransaction } from "@/lib/parseSpeechToTransaction"
import { emitTransactionSaved } from "@/lib/transactionEvents"
import Badge from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import Keypad from "@/components/quick-add/Keypad"

type Mode = "keypad" | "voice" | "receipt"
type TxType = "expense" | "income" | "savings"

const TYPE_COLOR_VAR: Record<TxType, string> = {
  expense: "var(--color-expense)",
  income: "var(--color-income)",
  savings: "var(--color-savings)",
}

interface QuickAddSheetProps {
  open: boolean
  onClose: () => void
}

const SWIPE_CLOSE_THRESHOLD = 100

export default function QuickAddSheet({ open, onClose }: QuickAddSheetProps) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<Mode>("keypad")
  const [visible, setVisible] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      setDragOffset(0)
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => {
        cancelAnimationFrame(raf)
      }
    } else {
      setVisible(false)
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const handleClosed = () => {
    onClose()
    setMode("keypad")
  }

  const handleDragStart = (clientY: number) => {
    dragStartY.current = clientY
    setIsDragging(true)
  }

  const handleDragMove = (clientY: number) => {
    const delta = clientY - dragStartY.current
    setDragOffset(delta > 0 ? delta : 0)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    if (dragOffset > SWIPE_CLOSE_THRESHOLD) {
      handleClosed()
    }
    setDragOffset(0)
  }

  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <div
        onClick={handleClosed}
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundColor: "var(--color-backdrop)",
          backdropFilter: "blur(4px)",
          opacity: visible ? 1 : 0,
        }}
      />
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 flex flex-col max-h-[88vh] ease-out",
          isDragging ? "transition-none" : "transition-transform duration-300",
        )}
        style={{
          backgroundColor: "var(--color-surface)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: visible ? `translateY(${dragOffset}px)` : "translateY(100%)",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.25)",
        }}
      >
        <div
          className="flex justify-center pt-2.5 pb-1 shrink-0 touch-none"
          onPointerDown={(e) => handleDragStart(e.clientY)}
          onPointerMove={(e) => isDragging && handleDragMove(e.clientY)}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: "var(--color-border)" }} />
        </div>

        <div
          className="px-4 pt-1 pb-3 shrink-0"
          onPointerDown={(e) => handleDragStart(e.clientY)}
          onPointerMove={(e) => isDragging && handleDragMove(e.clientY)}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="grid grid-cols-3 gap-1 p-1 rounded-full" style={{ backgroundColor: "var(--color-elevated)" }}>
            {(["keypad", "voice", "receipt"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="py-1.5 rounded-full text-sm font-semibold transition-colors"
                style={
                  mode === m
                    ? { backgroundColor: "var(--color-accent)", color: "#0C100E" }
                    : { color: "var(--color-text-secondary)" }
                }
              >
                {t(`quickAdd.mode.${m}` as const)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {mode === "keypad" && <KeypadMode onDone={handleClosed} />}
          {mode === "voice" && <VoiceMode onDone={handleClosed} />}
          {mode === "receipt" && <ReceiptMode />}
        </div>
      </div>
    </div>
  )
}

// ── Keypad mode ──────────────────────────────────────────────────────────

function KeypadMode({ onDone }: { onDone: () => void }) {
  const { t } = useLanguage()
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  const { currency, currencySymbol } = useCurrency()
  const { toast } = useToast()

  const [type, setType] = useState<TxType>("expense")
  const [amountStr, setAmountStr] = useState("")
  const [category, setCategory] = useState("")
  const [accountId, setAccountId] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts])
  const categoryOptions = useMemo(
    () => categories.filter((c) => c.type === type || c.type === "both" || type === "savings"),
    [categories, type],
  )

  const handleType = (next: TxType) => {
    setType(next)
    setCategory("")
  }

  const amountValue = Number(amountStr)
  const canSave = amountStr !== "" && amountValue > 0 && !!category

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: amountValue,
          category,
          description: description.trim(),
          date: format(new Date(), "yyyy-MM-dd"),
          isRecurring: false,
          accountId: accountId || null,
          currency,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? t("quickAdd.saveFailedToast"), "error")
        return
      }
      toast(t("quickAdd.addedToast"), "success")
      emitTransactionSaved()
      onDone()
    } catch {
      toast(t("common.genericError"), "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(["expense", "income", "savings"] as TxType[]).map((opt) => (
          <button
            key={opt}
            onClick={() => handleType(opt)}
            className="py-2 rounded-full text-sm font-semibold capitalize transition-colors"
            style={
              type === opt
                ? { backgroundColor: `var(--color-${opt}-bg)`, color: `var(--color-${opt})` }
                : { backgroundColor: "var(--color-elevated)", color: "var(--color-text-secondary)" }
            }
          >
            {t(`common.${opt}` as const)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center py-2">
        <span
          className="tabular-nums font-extrabold"
          style={{ fontSize: "2.6rem", color: TYPE_COLOR_VAR[type], lineHeight: 1 }}
        >
          {currencySymbol}
          {amountStr || "0"}
        </span>
      </div>

      <ChipScroller
        items={categoryOptions.map((c) => ({ id: c.name, label: c.name }))}
        selected={category}
        onSelect={setCategory}
        emptyLabel={t("quickAdd.selectCategory")}
      />

      <ChipScroller
        items={[
          { id: "", label: t("quickAdd.unassigned") },
          ...activeAccounts.map((a) => ({ id: a._id, label: a.name })),
        ]}
        selected={accountId}
        onSelect={setAccountId}
      />

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("quickAdd.description")}
        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
        style={{
          backgroundColor: "var(--color-elevated)",
          color: "var(--color-text-primary)",
        }}
      />

      <Keypad value={amountStr} onChange={setAmountStr} />

      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full py-3.5 rounded-xl font-bold text-white transition-opacity disabled:opacity-40"
        style={{
          background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
          boxShadow: canSave ? "0 4px 20px rgba(22,163,74,.35)" : "none",
        }}
      >
        {saving ? t("quickAdd.saving") : t("quickAdd.save")}
      </button>
    </div>
  )
}

export function ChipScroller({
  items,
  selected,
  onSelect,
  emptyLabel,
}: {
  items: { id: string; label: string }[]
  selected: string
  onSelect: (id: string) => void
  emptyLabel?: string
}) {
  if (items.length === 0) {
    return emptyLabel ? (
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {emptyLabel}
      </p>
    ) : null
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      {items.map((item) => {
        const isSelected = item.id === selected
        return (
          <button
            key={item.id || "__unassigned__"}
            onClick={() => onSelect(item.id)}
            className="shrink-0 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
            style={
              isSelected
                ? { backgroundColor: "var(--color-accent)", color: "#0C100E" }
                : { backgroundColor: "var(--color-elevated)", color: "var(--color-text-secondary)" }
            }
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Voice mode ───────────────────────────────────────────────────────────

function VoiceMode({ onDone }: { onDone: () => void }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { currency, formatAmount } = useCurrency()
  const { categories } = useCategories()
  const { keywords } = useVoiceKeywords()
  const { transcript, isListening, isSupported, startListening, stopListening, clearTranscript } = useSpeechToText()

  const [parsed, setParsed] = useState<ParsedTransaction | null>(null)
  const [noMatch, setNoMatch] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!transcript) return
    const result = parseSpeechToTransaction(transcript, keywords)
    if (result.type || result.amount || result.category) {
      setParsed(result)
      setNoMatch(false)
    } else {
      setNoMatch(true)
    }
  }, [transcript, keywords])

  const handleMicClick = () => {
    if (isListening) {
      stopListening()
    } else {
      clearTranscript()
      setParsed(null)
      setNoMatch(false)
      startListening()
    }
  }

  const handleRetry = () => {
    setParsed(null)
    setNoMatch(false)
    clearTranscript()
  }

  const resolvedCategory = useMemo(() => {
    if (!parsed) return ""
    if (parsed.category && categories.some((c) => c.name === parsed.category)) return parsed.category
    const type = parsed.type ?? "expense"
    const fallback = categories.find((c) => c.type === type || c.type === "both")
    return fallback?.name ?? ""
  }, [parsed, categories])

  const handleConfirm = async () => {
    if (!parsed || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: parsed.type ?? "expense",
          amount: parsed.amount ?? 0,
          category: resolvedCategory,
          description: parsed.description ?? "",
          date: format(new Date(), "yyyy-MM-dd"),
          isRecurring: false,
          accountId: null,
          currency,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? t("quickAdd.saveFailedToast"), "error")
        return
      }
      toast(t("quickAdd.addedToast"), "success")
      emitTransactionSaved()
      onDone()
    } catch {
      toast(t("common.genericError"), "error")
    } finally {
      setSaving(false)
    }
  }

  if (!isSupported) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "var(--color-text-muted)" }}>
        {t("quickAdd.voice.unsupported")}
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
        {isListening && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: "var(--color-accent)", opacity: 0.35 }}
          />
        )}
        <button
          onClick={handleMicClick}
          className="relative flex items-center justify-center rounded-full transition-colors"
          style={{
            width: 96,
            height: 96,
            border: "3px solid var(--color-accent)",
            backgroundColor: isListening ? "var(--color-expense-bg)" : "var(--color-sage)",
            color: isListening ? "var(--color-expense)" : "var(--color-accent)",
          }}
          aria-label={t("quickAdd.voice.toggleAria")}
        >
          {isListening ? <Square className="h-8 w-8" /> : <Mic className="h-9 w-9" />}
        </button>
      </div>

      <p className="text-sm text-center" style={{ color: "var(--color-text-secondary)" }}>
        {isListening ? t("quickAdd.voice.listening") : t("quickAdd.voice.prompt")}
      </p>

      {noMatch && (
        <div
          className="w-full flex items-center justify-between rounded-lg px-3 py-2"
          style={{ backgroundColor: "var(--color-expense-bg)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-expense)" }}>
            {t("quickAdd.voice.notHeard")}
          </p>
          <button
            onClick={handleRetry}
            className="text-xs font-semibold underline"
            style={{ color: "var(--color-expense)" }}
          >
            {t("quickAdd.voice.retry")}
          </button>
        </div>
      )}

      {parsed && (
        <div
          className="w-full rounded-xl p-4 space-y-3"
          style={{ backgroundColor: "var(--color-card)", borderLeft: "3px solid var(--color-accent)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            {t("quickAdd.voice.heard")}
          </p>
          {parsed.description && (
            <p className="text-sm italic" style={{ color: "var(--color-text-secondary)" }}>
              &ldquo;{parsed.description}&rdquo;
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {parsed.type && (
              <Badge variant={parsed.type === "expense" ? "danger" : parsed.type === "savings" ? "savings" : "success"}>
                {parsed.type}
              </Badge>
            )}
            {parsed.amount !== undefined && <Badge variant="default">{formatAmount(parsed.amount)}</Badge>}
            {resolvedCategory && <Badge variant="default">{resolvedCategory}</Badge>}
          </div>
          <button
            onClick={handleConfirm}
            disabled={saving || !parsed.amount}
            className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
          >
            {saving ? t("quickAdd.saving") : t("quickAdd.voice.confirm")}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Receipt mode (UI placeholder - no OCR backend yet) ────────────────────

function ReceiptMode() {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-4 py-2">
      <div
        className="flex flex-col items-center justify-center gap-2 py-10 rounded-xl"
        style={{ border: "2px dashed var(--color-border)" }}
      >
        <Camera className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
          {t("quickAdd.receipt.title")}
        </p>
        <p className="text-xs text-center px-6" style={{ color: "var(--color-text-muted)" }}>
          {t("quickAdd.receipt.subtitle")}
        </p>
      </div>

      <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "var(--color-card)" }}>
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--color-text-muted)" }}>{t("quickAdd.receipt.merchant")}</span>
          <span style={{ color: "var(--color-text-muted)" }}>-</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--color-text-muted)" }}>{t("quickAdd.receipt.total")}</span>
          <span className="tabular-nums" style={{ color: "var(--color-text-muted)" }}>
            -
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          disabled
          className={cn("flex-1 py-3 rounded-xl font-semibold cursor-not-allowed")}
          style={{ backgroundColor: "var(--color-elevated)", color: "var(--color-text-muted)" }}
        >
          {t("quickAdd.receipt.retake")}
        </button>
        <button
          disabled
          className={cn("flex-1 py-3 rounded-xl font-semibold cursor-not-allowed")}
          style={{ backgroundColor: "var(--color-elevated)", color: "var(--color-text-muted)" }}
        >
          {t("quickAdd.receipt.add")}
        </button>
      </div>
    </div>
  )
}
