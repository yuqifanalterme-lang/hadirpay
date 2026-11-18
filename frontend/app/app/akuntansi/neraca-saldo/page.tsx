import type { Metadata } from 'next'
import { TrialBalancePage } from '@/components/admin/accounting/trial-balance-page'

export const metadata: Metadata = { title: 'Neraca Saldo · HADIRPAY' }

export default function TrialBalanceRoute() {
  return <TrialBalancePage />
}
