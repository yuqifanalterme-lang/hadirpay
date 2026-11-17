import type { Metadata } from 'next'
import { AttendanceHistory } from '@/components/employee/attendance-history'

export const metadata: Metadata = { title: 'Riwayat Kehadiran · HADIRPAY' }

export default function AttendanceHistoryRoute() {
  return <AttendanceHistory />
}
