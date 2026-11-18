'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Chip, Field, FormModalLayout, moneyLabel } from '@/components/forms/FormParts'
import formStyles from '@/components/forms/forms.module.css'
import { useLanguage } from '@/context/LanguageContext'
import { addMonths, isDay, monthEnd } from '@/lib/planner/days'
import { MAX_PLANNER_NAME as MAX_SCENARIO_NAME } from '@/lib/constants'
import type { PlannerAccount } from '@/lib/planner/types'
import type { EditableFields } from './usePlanner'

interface PlanSettingsFormProps {
  name: string
  accountIds: string[]
  endDate: string
  accounts: PlannerAccount[]
  currency: string
  today: string
  maxDate: string
  onSave: (patch: Partial<EditableFields>) => void
  onCancel: () => void
}

/** Name, starting accounts and end date of a plan. Render inside <Modal variant="form">. */
export default function PlanSettingsForm({
  name: initialName, accountIds, endDate: initialEnd, accounts, currency, today, maxDate, onSave, onCancel,
}: PlanSettingsFormProps) {
  const { t } = useLanguage()
  const [name, setName] = useState(initialName)
  const [picked, setPicked] = useState(() => new Set(accountIds))
  const [endDate, setEndDate] = useState(initialEnd < today ? monthEnd(today) : initialEnd)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const quickEnds = [
    { label: t('planner.endThisMonth'), day: monthEnd(today) },
    { label: t('planner.endNextMonth'), day: monthEnd(addMonths(today, 1)) },
  ]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('planner.errName')
    if (!isDay(endDate) || endDate < today || endDate > maxDate) errs.endDate = t('planner.errEndDate')
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    const patch: Partial<EditableFields> = {}
    if (name.trim() !== initialName) patch.name = name.trim()
    // Keep the accounts list's order so the saved list doesn't churn
    const ids = accounts.map((a) => a.id).filter((id) => picked.has(id))
    if (ids.length !== accountIds.length || ids.some((id) => !accountIds.includes(id))) patch.accountIds = ids
    if (endDate !== initialEnd) patch.endDate = endDate
    onSave(patch)
  }

  return (
    <FormModalLayout
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </>
      }
    >
      <Input
        id="planner-name"
        label={t('planner.planName')}
        value={name}
        maxLength={MAX_SCENARIO_NAME}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />

      <Field label={t('planner.startFrom')} hint={t('planner.startFromHint').replace('{currency}', currency)}>
        {accounts.length === 0 ? (
          <span className={formStyles.hint}>{t('planner.noAccounts').replace('{currency}', currency)}</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {accounts.map((a) => {
              const on = picked.has(a.id)
              const isCard = a.type === 'credit'
              return (
                <label
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    backgroundColor: on ? 'var(--color-sage)' : 'transparent',
                  }}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(a.id)} style={{ accentColor: 'var(--color-accent)' }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: isCard ? 'var(--color-expense)' : 'var(--color-text-secondary)' }}>
                    {isCard ? `${t('planner.owed')} ${moneyLabel(a.figure, currency)}` : `${a.figure < 0 ? '-' : ''}${moneyLabel(a.figure, currency)}`}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </Field>

      <Field label={t('planner.until')} htmlFor="planner-end" error={errors.endDate}>
        <div className={formStyles.chips} style={{ marginBottom: 8 }}>
          {quickEnds.map((q) => (
            <Chip key={q.day} selected={endDate === q.day} onClick={() => setEndDate(q.day)}>
              {q.label}
            </Chip>
          ))}
        </div>
        <input
          id="planner-end"
          type="date"
          value={endDate}
          min={today}
          max={maxDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: '0.88rem',
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-input, var(--color-card))',
            color: 'var(--color-text-primary)',
          }}
        />
      </Field>
    </FormModalLayout>
  )
}
