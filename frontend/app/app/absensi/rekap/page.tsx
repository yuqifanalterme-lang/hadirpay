import type { Metadata } from 'next'
import { AttendanceRecapPage } from '@/components/admin/attendance/attendance-recap-page'

export const metadata: Metadata = { title: 'Rekap Absensi · HADIRPAY' }

export default function AttendanceRecapRoute() {
  return <AttendanceRecapPage />
}
