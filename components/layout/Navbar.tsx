"use client"

import Image from "next/image"
import Link from "next/link"
import { Sun, Moon, Search } from "lucide-react"
import UserMenu from "./UserMenu"
import NotificationBell from "./NotificationBell"
import { useTheme } from "@/context/ThemeContext"
import { useLanguage } from "@/context/LanguageContext"

interface NavbarProps {
  onMenuClick: () => void
  title?: string
  onSearchClick?: () => void
}

export default function Navbar({ onMenuClick, title, onSearchClick }: NavbarProps) {
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage } = useLanguage()

  return (
    <header
      className="h-16 flex items-center justify-between px-4 md:px-6 border-b sticky top-0 z-10"
      style={{ borderColor: "var(--color-border)", position: "relative" }}
    >
      {/* Blur layer as a pseudo-element so it doesn't create a stacking context on the header itself */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          backgroundColor: "var(--color-surface-blur)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      <div className="flex items-center gap-3 min-w-0" style={{ position: "relative", zIndex: 1 }}>
        {/* Logo - mobile only, sidebar handles desktop */}
        <Link href="/dashboard" className="flex items-center gap-2 lg:hidden shrink-0">
          <Image
            src={theme === "dark" ? "/logo-dark.png" : "/logo.png"}
            alt="Waiseka"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
            WaiseKa
          </span>
        </Link>
        {title && (
          <h1 className="text-lg font-semibold hidden sm:block shrink-0" style={{ color: "var(--color-text-primary)" }}>
            {title}
          </h1>
        )}

        {onSearchClick && (
          <button
            onClick={onSearchClick}
            className="hidden lg:flex items-center gap-2 w-full max-w-[360px]"
            style={{
              height: 36,
              borderRadius: 10,
              padding: "0 10px",
              backgroundColor: "var(--color-elevated)",
              border: "1px solid var(--color-border)",
            }}
            aria-label="Search or add a transaction"
          >
            <Search style={{ width: 14, height: 14, color: "var(--color-text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: "0.82rem", color: "var(--color-text-muted)", flex: 1, textAlign: "left" }}>
              Search or add - try &quot;grab 285 gcash&quot;
            </span>
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
              ⌘K
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0" style={{ position: "relative", zIndex: 1 }}>
        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === "en" ? "tl" : "en")}
          className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.96]"
          style={{
            backgroundColor: "var(--color-elevated)",
            border: "1px solid var(--color-border)",
            letterSpacing: "0.05em",
          }}
          aria-label={language === "en" ? "Switch to Filipino (Tagalog)" : "Switch to English"}
          title={language === "en" ? "Switch to Filipino" : "Switch to English"}
        >
          <span style={{ color: language === "en" ? "var(--color-accent)" : "var(--color-text-muted)" }}>EN</span>
          <span style={{ color: "var(--color-text-muted)", margin: "0 2px" }}>·</span>
          <span style={{ color: language === "tl" ? "var(--color-accent)" : "var(--color-text-muted)" }}>TL</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-all hover:opacity-70 active:scale-[0.95]"
          style={{ color: "var(--color-text-secondary)" }}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
