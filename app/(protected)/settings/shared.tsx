// Building blocks shared by the settings tabs.

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

// ── Toggle switch ────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: 44, height: 24,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-elevated)',
        transition: 'background-color 0.2s',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3, left: checked ? 23 : 3,
        width: 18, height: 18,
        borderRadius: '50%',
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

// ── Selection card (theme / reports view / currency / cutoff mode) ──────────
export function selectionCardStyle(isActive: boolean): React.CSSProperties {
  return {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '16px 12px', borderRadius: 14,
    border: isActive ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
    backgroundColor: isActive ? 'var(--color-sage)' : 'transparent',
    cursor: 'pointer', transition: 'all 0.15s',
  }
}

export const numberInputStyle: React.CSSProperties = {
  width: 48, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700,
  color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card)',
  border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 4px',
}

/** Props every tab takes - tabs stay mounted (keeping unsaved edits) and hide when inactive. */
export interface SettingsTabProps {
  hidden: boolean
}
