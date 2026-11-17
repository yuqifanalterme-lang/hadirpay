import type { Metadata } from 'next'
import { AttendancePage } from '@/components/employee/attendance-page'

export const metadata: Metadata = { title: 'Absensi · HADIRPAY' }

export default function AttendanceRoute() {
  return <AttendancePage />
}
