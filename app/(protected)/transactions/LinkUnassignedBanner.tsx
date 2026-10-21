'use client'

import { useState } from 'react'
import { Link2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { useDefaultAccount } from '@/hooks/useDefaultAccount'
import type { Account } from '@/hooks/useAccounts'

interface LinkUnassignedBannerProps {
  /** Active (non-archived) accounts. */
  accounts: Account[]
  onLinked: () => void
}

/**
 * Shown on the "Unassigned" view: unlinked entries never move a balance, which is a
 * quiet way for WaiseKa and the bank to drift apart. Lets the user link them all to one
 * account (after a confirm step); per-entry linking still works through the edit form.
 */
export default function LinkUnassignedBanner({ accounts, onLinked }: LinkUnassignedBannerProps) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { defaultAccountId } = useDefaultAccount()
  const [picked, setPicked] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const accountId = picked ?? defaultAccountId
  const account = accounts.find((a) => a._id === accountId)

  const link = async () => {
    if (!account) return
    setSaving(true)
    try {
      const res = await fetch('/api/transactions/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account._id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(data.error ?? t('link.failed'), 'error')
        return
      }
      const linked: number = data.linked ?? 0
      const skipped: number = data.skipped ?? 0
      const message = (linked === 1 ? t('link.doneOne') : t('link.done').replace('{n}', String(linked)))
        .replace('{account}', account.name)
      toast(skipped > 0 ? `${message}. ${t('link.skipped').replace('{n}', String(skipped))}` : message, 'success')
      setConfirming(false)
      onLinked()
    } catch {
      toast(t('common.genericError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="status" style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: '14px 16px', borderRadius: 12,
      backgroundColor: 'var(--color-warning-bg)',
      color: 'var(--color-warning)',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Link2 style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <p style={{ fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>{t('link.banner')}</p>
      </div>

      {confirming && account ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0, flex: '1 1 220px' }}>
            {t('link.confirm').replace('{currency}', account.currency).replace('{account}', account.name)}
          </p>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={link} loading={saving}>
            {t('link.confirmYes')}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <Select
              tone="token"
              label={t('link.allTo')}
              value={accountId}
              onValueChange={setPicked}
              options={accounts.map((a) => ({ value: a._id, label: `${a.name} (${a.currency})` }))}
            />
          </div>
          <Button size="sm" onClick={() => setConfirming(true)} disabled={!account}>
            {t('link.action')}
          </Button>
        </div>
      )}
    </div>
  )
}
