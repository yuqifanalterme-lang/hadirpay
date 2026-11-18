import type { Metadata } from 'next'
import { JournalPage } from '@/components/admin/accounting/journal-page'

export const metadata: Metadata = { title: 'Jurnal Umum · HADIRPAY' }

export default function JournalRoute() {
  return <JournalPage />
}
