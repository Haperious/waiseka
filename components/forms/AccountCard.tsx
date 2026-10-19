'use client'

import { useRef } from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'
import type { Account } from '@/hooks/useAccounts'
import { formatAmount } from '@/lib/currency'
import { ACCOUNT_TYPE_ICONS } from './accountTypes'
import styles from './forms.module.css'

/** Balance shown on the right of an account card: available for assets, outstanding (red) for cards. */
function AccountBalance({ account }: { account: Account }) {
  const isCredit = account.type === 'credit'
  const value = isCredit ? account.outstandingBalance ?? 0 : account.computedBalance ?? account.openingBalance
  return (
    <span className={styles.accountBalance}>
      <span
        className={styles.accountBalanceValue}
        style={{ color: isCredit ? 'var(--color-expense)' : 'var(--color-text-primary)' }}
      >
        {formatAmount(value, account.currency)}
      </span>
      <span className={styles.accountBalanceLabel}>{isCredit ? 'outstanding' : 'available'}</span>
    </span>
  )
}

function CardBody({ eyebrow, account, placeholder }: { eyebrow: string; account?: Account; placeholder: string }) {
  const Icon = account ? ACCOUNT_TYPE_ICONS[account.type] : null
  return (
    <>
      <span className={styles.accountChip}>{Icon && <Icon size={16} />}</span>
      <span className={styles.accountMain}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        {account ? (
          <span className={styles.accountName}>{account.name}</span>
        ) : (
          <span className={styles.accountPlaceholder}>{placeholder}</span>
        )}
      </span>
      {account && <AccountBalance account={account} />}
    </>
  )
}

interface AccountCardProps {
  eyebrow: string
  position: 'top' | 'bottom'
  value: string
  options: Account[]
  accounts: Account[]
  onChange: (id: string) => void
  placeholder: string
  /** Locked cards show the account without a picker or chevron. */
  locked?: boolean
  invalid?: boolean
}

/** One half of the From/To block in the transfer form; doubles as the account picker. */
export function AccountCard({ eyebrow, position, value, options, accounts, onChange, placeholder, locked, invalid }: AccountCardProps) {
  const account = accounts.find((a) => a._id === value)
  const openRef = useRef(false)
  const className = [
    styles.accountCard,
    position === 'top' ? styles.accountCardTop : styles.accountCardBottom,
    invalid ? styles.accountCardError : '',
  ].join(' ')

  if (locked) {
    return (
      <div className={className}>
        <CardBody eyebrow={eyebrow} account={account} placeholder={placeholder} />
      </div>
    )
  }

  return (
    <RadixSelect.Root
      value={value || undefined}
      // Ignore the hidden native select's "" echo (see components/ui/Select.tsx)
      onValueChange={(next) => {
        if (next === '' && value && !openRef.current) return
        onChange(next)
      }}
      onOpenChange={(open) => { openRef.current = open }}
    >
      <RadixSelect.Trigger className={className} aria-label={`${eyebrow} account`} aria-invalid={invalid || undefined}>
        <CardBody eyebrow={eyebrow} account={account} placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className={styles.pickerContent}
          position="popper"
          sideOffset={4}
          style={{ width: 'var(--radix-select-trigger-width)', maxHeight: 'min(var(--radix-select-content-available-height), 300px)' }}
        >
          <RadixSelect.Viewport style={{ padding: 4 }}>
            {options.length === 0 && <div className={styles.hint} style={{ padding: 10 }}>No matching accounts</div>}
            {options.map((a) => {
              const Icon = ACCOUNT_TYPE_ICONS[a.type]
              return (
                <RadixSelect.Item key={a._id} value={a._id} className={styles.pickerItem}>
                  <Icon size={15} style={{ color: 'var(--color-text-muted)' }} />
                  <RadixSelect.ItemText>{a.name}</RadixSelect.ItemText>
                  <span className={styles.hint} style={{ marginLeft: 'auto' }}>{a.currency}</span>
                </RadixSelect.Item>
              )
            })}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
