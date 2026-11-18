import type { Metadata } from 'next'
import { ReportsIndexPage } from '@/components/admin/reports/reports-page'

export const metadata: Metadata = { title: 'Laporan · HADIRPAY' }

export default function ReportsRoute() {
  return <ReportsIndexPage />
}
