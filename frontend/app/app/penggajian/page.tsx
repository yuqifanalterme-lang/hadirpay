import type { Metadata } from 'next'
import { PayrollPage } from '@/components/admin/payroll/payroll-page'

export const metadata: Metadata = { title: 'Penggajian · HADIRPAY' }

export default function PayrollRoute() {
  return <PayrollPage />
}
