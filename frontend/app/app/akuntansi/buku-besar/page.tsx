import type { Metadata } from 'next'
import { GeneralLedgerPage } from '@/components/admin/accounting/general-ledger-page'

export const metadata: Metadata = { title: 'Buku Besar · HADIRPAY' }

export default function GeneralLedgerRoute() {
  return <GeneralLedgerPage />
}
