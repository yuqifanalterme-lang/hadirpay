import type { Metadata } from 'next'
import { AccountsPage } from '@/components/admin/accounting/accounts-page'

export const metadata: Metadata = { title: 'Data Akun · HADIRPAY' }

export default function AccountsRoute() {
  return <AccountsPage />
}
