import type { Metadata } from 'next'
import { EmployeeDetail } from '@/components/admin/employees/employee-detail'

export const metadata: Metadata = { title: 'Detail Karyawan · HADIRPAY' }

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EmployeeDetail id={id} />
}
