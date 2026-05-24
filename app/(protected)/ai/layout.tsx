import PremiumGate from '@/components/PremiumGate'

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return <PremiumGate>{children}</PremiumGate>
}
