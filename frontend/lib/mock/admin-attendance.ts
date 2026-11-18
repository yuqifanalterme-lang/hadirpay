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
  overtimeMinutes: number
  lateMinutes: number
}

export const adminAttendanceDemoDate = '2026-11-17'

export const mockAdminDailyAttendance: AdminDailyAttendance[] = [
  { employeeId: 'HP-0001', date: adminAttendanceDemoDate, checkIn: '07.52', checkOut: '17.04', status: 'Hadir', location: 'Kantor Pusat' },
  { employeeId: 'HP-0002', date: adminAttendanceDemoDate, checkIn: '07.58', checkOut: '17.03', status: 'Hadir', location: 'Gudang Utama' },
  { employeeId: 'HP-0003', date: adminAttendanceDemoDate, checkIn: null, checkOut: null, status: 'Izin', location: null },
  { employeeId: 'HP-0004', date: adminAttendanceDemoDate, checkIn: '07.55', checkOut: '18.20', status: 'Hadir', location: 'Kantor Pusat' },
  { employeeId: 'HP-0005', date: adminAttendanceDemoDate, checkIn: '08.17', checkOut: null, status: 'Terlambat', location: 'Gudang Utama' },
  { employeeId: 'HP-0006', date: adminAttendanceDemoDate, checkIn: '07.45', checkOut: null, status: 'Hadir', location: 'Kantor Pusat' },
  { employeeId: 'HP-0007', date: adminAttendanceDemoDate, checkIn: null, checkOut: null, status: 'Cuti', location: null },
  { employeeId: 'HP-0008', date: adminAttendanceDemoDate, checkIn: null, checkOut: null, status: 'Alpha', location: null },
  { employeeId: 'HP-0009', date: adminAttendanceDemoDate, checkIn: '07.56', checkOut: '17.00', status: 'Hadir', location: 'Kantor Pusat' },
]

export const mockMonthlyAttendanceSummary: MonthlyAttendanceSummary[] = [
  { employeeId: 'HP-0001', period: '2026-11', workDays: 21, present: 17, late: 2, permission: 1, sick: 0, leave: 1, absent: 0, overtimeMinutes: 270, lateMinutes: 34 },
  { employeeId: 'HP-0002', period: '2026-11', workDays: 21, present: 15, late: 3, permission: 1, sick: 0, leave: 2, absent: 0, overtimeMinutes: 120, lateMinutes: 42 },
  { employeeId: 'HP-0003', period: '2026-11', workDays: 21, present: 17, late: 1, permission: 1, sick: 1, leave: 1, absent: 0, overtimeMinutes: 60, lateMinutes: 12 },
  { employeeId: 'HP-0004', period: '2026-11', workDays: 21, present: 18, late: 2, permission: 0, sick: 0, leave: 0, absent: 1, overtimeMinutes: 360, lateMinutes: 27 },
  { employeeId: 'HP-0005', period: '2026-11', workDays: 21, present: 16, late: 1, permission: 1, sick: 1, leave: 1, absent: 1, overtimeMinutes: 90, lateMinutes: 15 },
  { employeeId: 'HP-0006', period: '2026-11', workDays: 21, present: 19, late: 1, permission: 0, sick: 0, leave: 1, absent: 0, overtimeMinutes: 30, lateMinutes: 9 },
  { employeeId: 'HP-0007', period: '2026-11', workDays: 21, present: 16, late: 3, permission: 0, sick: 0, leave: 0, absent: 2, overtimeMinutes: 180, lateMinutes: 48 },
  { employeeId: 'HP-0008', period: '2026-11', workDays: 21, present: 16, late: 1, permission: 1, sick: 1, leave: 1, absent: 1, overtimeMinutes: 150, lateMinutes: 18 },
  { employeeId: 'HP-0009', period: '2026-11', workDays: 21, present: 18, late: 1, permission: 0, sick: 0, leave: 1, absent: 1, overtimeMinutes: 240, lateMinutes: 11 },
]
