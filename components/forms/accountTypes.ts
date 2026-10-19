import { Banknote, CreditCard, Landmark, Lock, PiggyBank, Smartphone, type LucideIcon } from 'lucide-react'
import type { Account } from '@/hooks/useAccounts'
import type { TranslationKey } from '@/lib/translations'

export const ACCOUNT_TYPE_KEYS: Record<Account['type'], TranslationKey> = {
  debit: 'account.typeDebit',
  credit: 'account.typeCredit',
  savings: 'account.typeSavings',
  time_deposit: 'account.typeTimeDeposit',
  cash: 'account.typeCash',
  e_wallet: 'account.typeEWallet',
}

export const ACCOUNT_TYPE_ICONS: Record<Account['type'], LucideIcon> = {
  debit: Landmark,
  credit: CreditCard,
  savings: PiggyBank,
  time_deposit: Lock,
  cash: Banknote,
  e_wallet: Smartphone,
}
