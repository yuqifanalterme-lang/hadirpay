import type { Metadata } from 'next'
import { ReportDetailPage } from '@/components/admin/reports/reports-page'

export const metadata: Metadata = { title: 'Detail Laporan · HADIRPAY' }

export default async function ReportDetailRoute({
  params,
}: {
  params: Promise<{ report: string }>
}) {
  const { report } = await params
  return <ReportDetailPage reportId={report} />
}
