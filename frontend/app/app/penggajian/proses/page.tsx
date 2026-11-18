import type { Metadata } from 'next'
import { PayrollProcessPage } from '@/components/admin/payroll/payroll-process-page'

export const metadata: Metadata = { title: 'Proses Penggajian · HADIRPAY' }

export default function PayrollProcessRoute() {
  return <PayrollProcessPage />
}
