import type { Metadata } from 'next'
import { EmployeeList } from '@/components/admin/employees/employee-list'

export const metadata: Metadata = { title: 'Data Karyawan · HADIRPAY' }

export default function EmployeesPage() {
  return <EmployeeList />
}
