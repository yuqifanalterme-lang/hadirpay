import type { Metadata } from 'next'
import { EmployeeDashboard } from '@/components/employee/employee-dashboard'

export const metadata: Metadata = { title: 'Beranda Karyawan · HADIRPAY' }

export default function EmployeeHomePage() {
  return <EmployeeDashboard />
}
