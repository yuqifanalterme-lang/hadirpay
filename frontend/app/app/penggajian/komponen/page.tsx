import type { Metadata } from 'next'
import { PayrollComponentsPage } from '@/components/admin/payroll/payroll-components-page'

export const metadata: Metadata = { title: 'Komponen Gaji · HADIRPAY' }

export default function PayrollComponentsRoute() {
  return <PayrollComponentsPage />
}
