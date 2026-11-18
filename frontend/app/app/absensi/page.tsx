import type { Metadata } from 'next'
import { AttendanceRolePage } from '@/components/admin/attendance/attendance-role-page'

export const metadata: Metadata = { title: 'Absensi · HADIRPAY' }

export default function AttendanceRoute() {
  return <AttendanceRolePage />
}
