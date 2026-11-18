import type { Metadata } from 'next'
import { PayslipPage } from '@/components/admin/payroll/payslip-page'

export const metadata: Metadata = { title: 'Slip Gaji · HADIRPAY' }

export default function PayslipRoute() {
  return <PayslipPage />
}
