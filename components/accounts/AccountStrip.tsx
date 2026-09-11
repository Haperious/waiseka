"use client"

import { useEffect, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  Settings,
  RefreshCw,
  Landmark,
  CreditCard,
  PiggyBank,
  Banknote,
  Smartphone,
  Wallet,
} from "lucide-react"
import { SkeletonCard } from "@/components/ui/Skeleton"
import { useToast } from "@/components/ui/Toast"
import AccountBalanceCard from "./AccountBalanceCard"
import type { Account } from "@/hooks/useAccounts"

const TYPE_ICON: Record<Account["type"], React.ElementType> = {
  debit: Landmark,
  credit: CreditCard,
  savings: PiggyBank,
  time_deposit: PiggyBank,
  cash: Banknote,
  e_wallet: Smartphone,
}

interface AccountStripProps {
  /** All non-archived accounts. */
  accounts: Account[]
  accountsLoading: boolean
  accountsError: string | null
  onRetry: () => void
  /** '' when no card is active. */
  activeAccountId: string
  onSelectAccount: (id: string) => void
  hiddenAccountIds: string[]
  onChangeHiddenAccountIds: (ids: string[]) => Promise<void>
  collapsed: boolean
  onToggleCollapsed: () => Promise<void>
}

export default function AccountStrip({
  accounts,
  accountsLoading,
  accountsError,
  onRetry,
  activeAccountId,
  onSelectAccount,
  hiddenAccountIds,
  onChangeHiddenAccountIds,
  collapsed,
  onToggleCollapsed,
}: AccountStripProps) {
  const { toast } = useToast()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settingsOpen) return
    function handlePointerDown(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSettingsOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [settingsOpen])

  const visibleAccounts = accounts.filter((a) => !hiddenAccountIds.includes(a._id))
  const isInitialLoad = accountsLoading && accounts.length === 0

  const toggleHidden = async (accountId: string) => {
    const next = hiddenAccountIds.includes(accountId)
      ? hiddenAccountIds.filter((id) => id !== accountId)
      : [...hiddenAccountIds, accountId]
    try {
      await onChangeHiddenAccountIds(next)
    } catch {
      toast("Failed to update visible accounts", "error")
    }
  }

  const showAll = async () => {
    try {
      await onChangeHiddenAccountIds([])
    } catch {
      toast("Failed to update visible accounts", "error")
    }
  }

  const handleToggleCollapsed = async () => {
    try {
      await onToggleCollapsed()
    } catch {
      toast("Failed to save strip state", "error")
    }
  }

  return (
    <div
      style={{
        backgroundColor: "var(--color-card)",
        borderRadius: 16,
        border: "1px solid var(--color-border)",
        padding: "12px 14px",
      }}
    >
      {/* ── Header - always renders, even at zero/all-hidden accounts (D11) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Accounts
        </span>
        <div style={{ display: "flex", gap: 2, position: "relative" }} ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Choose visible accounts"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            <Settings style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={handleToggleCollapsed}
            aria-label={collapsed ? "Expand accounts" : "Collapse accounts"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            {collapsed ? (
              <ChevronDown style={{ width: 14, height: 14 }} />
            ) : (
              <ChevronUp style={{ width: 14, height: 14 }} />
            )}
          </button>

          {settingsOpen && (
            <div
              style={{
                position: "absolute",
                top: 32,
                right: 0,
                zIndex: 20,
                width: 220,
                maxHeight: 260,
                overflowY: "auto",
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                padding: 8,
              }}
            >
              {accounts.length === 0 ? (
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", padding: "8px 6px" }}>
                  No accounts to show yet.
                </p>
              ) : (
                <>
                  {accounts.map((account) => {
                    const Icon = TYPE_ICON[account.type] ?? Wallet
                    const visible = !hiddenAccountIds.includes(account._id)
                    return (
                      <label
                        key={account._id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => toggleHidden(account._id)}
                          style={{ accentColor: "var(--color-accent)" }}
                        />
                        <Icon style={{ width: 13, height: 13, color: "var(--color-text-muted)", flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--color-text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {account.name}
                        </span>
                      </label>
                    )
                  })}
                  <button
                    onClick={showAll}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px",
                      borderRadius: 8,
                      border: "none",
                      backgroundColor: "transparent",
                      color: "var(--color-accent)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    Show all
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Card row ─────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ marginTop: 10 }}>
          {accountsError ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--color-expense)" }}>
                Couldn&apos;t load account balances.
              </span>
              <button
                onClick={onRetry}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--color-accent)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RefreshCw style={{ width: 12, height: 12 }} />
                Retry
              </button>
            </div>
          ) : isInitialLoad ? (
            <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ minWidth: 150, maxWidth: 150, flexShrink: 0 }}>
                  <SkeletonCard />
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", padding: "8px 2px" }}>
              No accounts yet - add one to see balances here.
            </p>
          ) : visibleAccounts.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>All accounts hidden.</span>
              <button
                onClick={showAll}
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--color-accent)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Show accounts
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: 10,
                overflowX: "auto",
                overflowY: "hidden",
                WebkitOverflowScrolling: "touch",
                scrollSnapType: "x proximity",
                paddingBottom: 2,
              }}
            >
              {visibleAccounts.map((account) => (
                <AccountBalanceCard
                  key={account._id}
                  account={account}
                  active={activeAccountId === account._id}
                  onClick={() => onSelectAccount(account._id)}
                  balanceLoading={accountsLoading}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
