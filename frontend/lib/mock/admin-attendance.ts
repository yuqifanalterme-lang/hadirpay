import type { EmployeeAttendanceStatus } from '@/lib/mock/attendance'

export type AdminDailyAttendance = {
  employeeId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: EmployeeAttendanceStatus
  location: string | null
}

export type MonthlyAttendanceSummary = {
  employeeId: string
  period: string
  workDays: number
  present: number
  late: number
  permission: number
  sick: number
  leave: number
  absent: number
  lateMinutes: number
}

export const adminAttendanceDemoDate = '2026-11-17'

export const mockAdminDailyAttendance: AdminDailyAttendance[] = [
  { employeeId: 'HP-0001', date: adminAttendanceDemoDate, checkIn: '07.52', checkOut: '17.04', status: 'Hadir', location: 'Kantor Pusat' },
  { employeeId: 'HP-0002', date: adminAttendanceDemoDate, checkIn: '07.58', checkOut: '17.03', status: 'Hadir', location: 'Gudang Utama' },
  { employeeId: 'HP-0003', date: adminAttendanceDemoDate, checkIn: null, checkOut: null, status: 'Izin', location: null },
  { employeeId: 'HP-0004', date: adminAttendanceDemoDate, checkIn: '07.55', checkOut: '17.00', status: 'Hadir', location: 'Kantor Pusat' },
  { employeeId: 'HP-0005', date: adminAttendanceDemoDate, checkIn: '08.17', checkOut: null, status: 'Terlambat', location: 'Gudang Utama' },
  { employeeId: 'HP-0006', date: adminAttendanceDemoDate, checkIn: '07.45', checkOut: null, status: 'Hadir', location: 'Kantor Pusat' },
  { employeeId: 'HP-0007', date: adminAttendanceDemoDate, checkIn: null, checkOut: null, status: 'Cuti', location: null },
  { employeeId: 'HP-0008', date: adminAttendanceDemoDate, checkIn: null, checkOut: null, status: 'Alpha', location: null },
  { employeeId: 'HP-0009', date: adminAttendanceDemoDate, checkIn: '07.56', checkOut: '17.00', status: 'Hadir', location: 'Kantor Pusat' },
]

export const mockMonthlyAttendanceSummary: MonthlyAttendanceSummary[] = [
]
