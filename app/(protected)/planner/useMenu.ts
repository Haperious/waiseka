'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const itemsIn = (menu: HTMLElement | null) =>
  Array.from(menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])

/**
 * Open/close state for a trigger + menu pair with real menu behaviour: Escape and an
 * outside click close it, focus moves into the menu on open and back to the trigger on
 * close, and arrow keys / Home / End move between enabled items.
 */
export function useMenu<T extends HTMLElement = HTMLButtonElement>() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<T>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    // The checked item (picker) or the first one gets focus
    const list = itemsIn(menuRef.current)
    const checked = list.find((el) => el.getAttribute('aria-checked') === 'true')
    ;(checked ?? list[0])?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      } else if (e.key === 'Tab') {
        close(false)
      }
    }
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close(false)
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close])

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const list = itemsIn(menuRef.current)
    if (list.length === 0) return
    const i = list.indexOf(document.activeElement as HTMLElement)
    let next = -1
    if (e.key === 'ArrowDown') next = (i + 1) % list.length
    else if (e.key === 'ArrowUp') next = (i - 1 + list.length) % list.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = list.length - 1
    if (next < 0) return
    e.preventDefault()
    list[next].focus()
  }

  return {
    open,
    toggle: () => setOpen((v) => !v),
    close,
    triggerRef,
    menuRef,
    onMenuKeyDown,
  }
}
