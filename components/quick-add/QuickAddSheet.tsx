"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { Calculator, CalendarDays, Camera, ChevronDown, Layers, Mic, PenLine, Receipt, Square, Tag, Wallet } from "lucide-react"
import { useCategories } from "@/hooks/useCategories"
import { useAccounts } from "@/hooks/useAccounts"
import { useDefaultAccount } from "@/hooks/useDefaultAccount"
import { accountIdForSubmit } from "@/lib/accountSelection"
import { useCurrency } from "@/context/CurrencyContext"
import { getCurrencySymbol } from "@/lib/currency"
import { useToast } from "@/components/ui/Toast"
import { useLanguage } from "@/context/LanguageContext"
import { useSpeechToText } from "@/hooks/useSpeechToText"
import { useVoiceKeywords } from "@/hooks/useVoiceKeywords"
import { parseSpeechToTransaction, ParsedTransaction } from "@/lib/parseSpeechToTransaction"
import { emitTransactionSaved } from "@/lib/transactionEvents"
import type { Transaction } from "@/hooks/useTransactions"
import Badge from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import Keypad from "@/components/quick-add/Keypad"
import { orderCategoryChips } from "@/lib/categoryChips"
import styles from "./quickAdd.module.css"

type Mode = "keypad" | "voice" | "receipt"

// Chip shown while accounts are still loading; saving then lets the server pick the default account
const PENDING_DEFAULT = "__default__"
type TxType = "expense" | "income" | "savings"

const TYPE_COLOR_VAR: Record<TxType, string> = {
  expense: "var(--color-expense)",
  income: "var(--color-income)",
  savings: "var(--color-savings)",
}

interface QuickAddSheetProps {
  open: boolean
  onClose: () => void
  /** Opens the Add Multiple sheet; the header link is hidden when not provided. */
  onAddMultiple?: () => void
  /** Edits this transaction instead of adding one: keypad only, pre-filled, saves with PUT. */
  transaction?: Transaction | null
}

const MODE_ICONS = { keypad: Calculator, voice: Mic, receipt: Receipt } as const

const SWIPE_CLOSE_THRESHOLD = 100

export default function QuickAddSheet({ open, onClose, onAddMultiple, transaction }: QuickAddSheetProps) {
  const { t } = useLanguage()
  const isEdit = !!transaction
  const title = isEdit ? t("tx.editTitle") : t("quickAdd.title")
  const [mode, setMode] = useState<Mode>("keypad")
  const [visible, setVisible] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)

  // Reset per open/close (adjusted during render, not in an effect)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setDragOffset(0)
    else setVisible(false)
  }

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => {
      cancelAnimationFrame(raf)
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
        className={cn(styles.sheet, isDragging ? "transition-none" : "transition-transform duration-300 ease-out")}
        style={{ transform: visible ? `translateY(${dragOffset}px)` : "translateY(100%)" }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className={styles.handleArea}
          onPointerDown={(e) => handleDragStart(e.clientY)}
          onPointerMove={(e) => isDragging && handleDragMove(e.clientY)}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className={styles.handle} />
        </div>

        <div
          className={styles.top}
          onPointerDown={(e) => handleDragStart(e.clientY)}
          onPointerMove={(e) => isDragging && handleDragMove(e.clientY)}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            {onAddMultiple && !isEdit && (
              <button
                type="button"
                className={styles.multipleLink}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  handleClosed()
                  onAddMultiple()
                }}
              >
                <Layers size={14} />
                {t("quickAdd.addMultiple")}
              </button>
            )}
          </div>
          {!isEdit && <div className={styles.modes} role="tablist">
            {(["keypad", "voice", "receipt"] as Mode[]).map((m) => {
              const Icon = MODE_ICONS[m]
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setMode(m)}
                  className={cn(styles.mode, mode === m && styles.modeOn)}
                >
                  <Icon size={14} />
                  {t(`quickAdd.mode.${m}` as const)}
                </button>
              )
            })}
          </div>}
        </div>

        {isEdit ? (
          // Keyed so switching to another transaction re-seeds the form
          <KeypadMode key={transaction._id} transaction={transaction} onDone={handleClosed} />
        ) : mode === "keypad" && <KeypadMode onDone={handleClosed} />}
        {!isEdit && mode === "voice" && (
          <div className={styles.body}>
            <VoiceMode onDone={handleClosed} />
          </div>
        )}
        {!isEdit && mode === "receipt" && (
          <div className={styles.body}>
            <ReceiptMode />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Keypad mode ──────────────────────────────────────────────────────────

function KeypadMode({ onDone, transaction }: { onDone: () => void; transaction?: Transaction }) {
  const { t } = useLanguage()
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  const { currency: primaryCurrency } = useCurrency()
  const { toast } = useToast()

  // Transfers have no edit action, so an edited transaction is always one of these types
  const [type, setType] = useState<TxType>((transaction?.type as TxType | undefined) ?? "expense")
  const [amountStr, setAmountStr] = useState(transaction ? String(transaction.amount) : "")
  const [category, setCategory] = useState(transaction?.category ?? "")
  // null = not picked yet, so the entry falls back to the default account ('' = unassigned)
  const [chosenAccountId, setAccountId] = useState<string | null>(transaction ? transaction.accountId ?? "" : null)
  const [description, setDescription] = useState(transaction?.description ?? "")
  const [date, setDate] = useState(() => format(transaction ? new Date(transaction.date) : new Date(), "yyyy-MM-dd"))
  const [saving, setSaving] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Keep an edited transaction's archived account selectable so it isn't silently moved
  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.isArchived || a._id === transaction?.accountId),
    [accounts, transaction?.accountId],
  )
  const { defaultAccountId, ready: defaultReady } = useDefaultAccount()
  const accountId = chosenAccountId ?? defaultAccountId
  const accountPending = chosenAccountId === null && !defaultReady
  // The symbol follows the selected account (unassigned → primary), matching what the server saves
  const currencySymbol = getCurrencySymbol(
    activeAccounts.find((a) => a._id === accountId)?.currency ?? primaryCurrency,
  )
  const categoryOptions = useMemo(
    () => categories.filter((c) => c.type === type || c.type === "both" || type === "savings"),
    [categories, type],
  )
  // Most used first, ordered per type
  const orderedCategories = useMemo(() => orderCategoryChips(categoryOptions, ""), [categoryOptions])

  const handleType = (next: TxType) => {
    setType(next)
    setCategory("")
  }

  const amountValue = Number(amountStr)
  const canSave = amountStr !== "" && amountValue > 0 && !!category

  const accountLabel = accountPending
    ? t("common.defaultAccount")
    : activeAccounts.find((a) => a._id === accountId)?.name ?? t("quickAdd.unassigned")
  const today = format(new Date(), "yyyy-MM-dd")
  const dateLabel = date === today ? t("common.today") : format(new Date(`${date}T00:00:00`), "MMM d")
  const amountLabel =
    amountValue > 0
      ? `${currencySymbol}${amountValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : ""

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const fields = {
        type,
        amount: amountValue,
        category,
        description: description.trim(),
        date,
        accountId: accountIdForSubmit(chosenAccountId, defaultAccountId, defaultReady),
      }
      // Edits leave isRecurring/tags as they are (PUT only updates the fields it's sent)
      const res = transaction
        ? await fetch(`/api/transactions/${transaction._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
          })
        : await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...fields, isRecurring: false }),
          })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? t("quickAdd.saveFailedToast"), "error")
        return
      }
      toast(transaction ? t("form.txUpdated") : t("quickAdd.addedToast"), "success")
      emitTransactionSaved()
      onDone()
    } catch {
      toast(t("common.genericError"), "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className={styles.body}>
        <div className={styles.types}>
          {(["expense", "income", "savings"] as TxType[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleType(opt)}
              className={styles.typePill}
              aria-pressed={type === opt}
              style={type === opt ? { backgroundColor: `var(--color-${opt}-bg)`, color: TYPE_COLOR_VAR[opt] } : undefined}
            >
              {t(`common.${opt}` as const)}
            </button>
          ))}
        </div>

        <div className={styles.amount} aria-live="polite">
          <span className={styles.amountSymbol}>{currencySymbol}</span>
          <span className={styles.amountValue} style={{ color: TYPE_COLOR_VAR[type] }}>
            {amountStr || "0"}
          </span>
          <span className={styles.caret} aria-hidden="true" />
        </div>

        <CategoryPicker categories={orderedCategories} value={category} onChange={setCategory} />

        <div className={styles.pills}>
          <label className={styles.pill}>
            <Wallet size={15} />
            <span className={styles.pillLabel}>{accountLabel}</span>
            <ChevronDown size={14} />
            <select
              className={styles.pillNative}
              aria-label={t("quickAdd.account")}
              value={accountPending ? PENDING_DEFAULT : accountId}
              onChange={(e) => setAccountId(e.target.value === PENDING_DEFAULT ? null : e.target.value)}
            >
              {accountPending && <option value={PENDING_DEFAULT}>{t("common.defaultAccount")}</option>}
              <option value="">{t("quickAdd.unassigned")}</option>
              {activeAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.pill}>
            <CalendarDays size={15} />
            <span className={styles.pillLabel}>{dateLabel}</span>
            <ChevronDown size={14} />
            <input
              ref={dateInputRef}
              type="date"
              className={styles.pillNative}
              aria-label="Date"
              value={date}
              onClick={() => {
                try {
                  dateInputRef.current?.showPicker()
                } catch {
                  // showPicker() unsupported - the native control still opens on tap
                }
              }}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
        </div>

        <label className={styles.pill}>
          <PenLine size={15} />
          <input
            type="text"
            className={styles.noteInput}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("quickAdd.notePlaceholder")}
            enterKeyHint="done"
          />
        </label>

        <Keypad value={amountStr} onChange={setAmountStr} keyHeight={48} />
      </div>

      <div className={styles.footer}>
        <button type="button" onClick={handleSave} disabled={!canSave || saving} className={styles.cta}>
          {saving
            ? t("quickAdd.saving")
            : `${transaction ? t("quickAdd.saveChanges") : t(`quickAdd.add.${type}` as const)}${amountLabel ? ` · ${amountLabel}` : ""}`}
        </button>
      </div>
    </>
  )
}

/**
 * Full-width category dropdown pill. Opens the OS picker so every category is
 * reachable at once, instead of a sideways-scrolling chip row that hides most of them.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  /** Already filtered for the current type and ordered (most used first). */
  categories: { _id: string; name: string }[]
  value: string
  onChange: (name: string) => void
}) {
  const { t } = useLanguage()
  if (categories.length === 0) {
    return <p className={styles.emptyHint}>{t("form.noCategoriesForType")}</p>
  }
  return (
    <label className={cn(styles.pill, value && styles.pillOn)}>
      <Tag size={15} />
      <span className={cn(styles.pillLabel, !value && styles.pillPlaceholder)}>
        {value || t("quickAdd.selectCategory")}
      </span>
      <ChevronDown size={14} />
      <select
        className={styles.pillNative}
        aria-label={t("common.category")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {t("quickAdd.selectCategory")}
        </option>
        {categories.map((c) => (
          <option key={c._id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}

// ── Voice mode ───────────────────────────────────────────────────────────

function VoiceMode({ onDone }: { onDone: () => void }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  // Voice entries go to the default account (server resolves it if still loading),
  // so amounts show in that account's currency (unassigned → primary)
  const { formatAmountIn } = useCurrency()
  const { accounts } = useAccounts()
  const { defaultAccountId, ready: defaultReady } = useDefaultAccount()
  const defaultCurrency = accounts.find((a) => a._id === defaultAccountId)?.currency
  const { categories } = useCategories()
  const { keywords } = useVoiceKeywords()
  const { transcript, isListening, isSupported, startListening, stopListening, clearTranscript } = useSpeechToText()

  const [saving, setSaving] = useState(false)

  // Derived from the transcript - mic clicks and retry both clear it, which resets these
  const voiceResult = useMemo<ParsedTransaction | null>(
    () => (transcript ? parseSpeechToTransaction(transcript, keywords) : null),
    [transcript, keywords],
  )
  const matched = Boolean(voiceResult && (voiceResult.type || voiceResult.amount || voiceResult.category))
  const parsed = matched ? voiceResult : null
  const noMatch = voiceResult !== null && !matched

  const handleMicClick = () => {
    if (isListening) {
      stopListening()
    } else {
      clearTranscript()
      startListening()
    }
  }

  const handleRetry = () => clearTranscript()

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
          accountId: accountIdForSubmit(null, defaultAccountId, defaultReady),
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
            {parsed.amount !== undefined && <Badge variant="default">{formatAmountIn(parsed.amount, defaultCurrency)}</Badge>}
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
