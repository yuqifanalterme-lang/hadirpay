export const attendanceStatuses = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Cuti', 'Alpha'] as const

export type EmployeeAttendanceStatus = (typeof attendanceStatuses)[number]

export type EmployeeAttendanceRecord = {
  date: string
  checkIn: string | null
  checkOut: string | null
  status: EmployeeAttendanceStatus
  isMock: true
}

export type AttendanceCorrection = {
  id: string
  date: string
  field: 'Masuk' | 'Pulang'
  correctedTime: string
  reason: string
  submittedAt: string
  submittedOn?: string
  status: 'Menunggu' | 'Disetujui' | 'Ditolak'
  approvedBy?: string
  rejectionReason?: string
  isMock: true
}

export const mockEmployeeAttendance: EmployeeAttendanceRecord[] = [
  { date: '2026-11-02', checkIn: '07.52', checkOut: '17.04', status: 'Hadir', isMock: true },
  { date: '2026-11-03', checkIn: '08.12', checkOut: '17.03', status: 'Terlambat', isMock: true },
  { date: '2026-11-04', checkIn: '07.48', checkOut: '17.02', status: 'Hadir', isMock: true },
  { date: '2026-11-05', checkIn: '07.55', checkOut: '17.00', status: 'Hadir', isMock: true },
  { date: '2026-11-06', checkIn: null, checkOut: null, status: 'Izin', isMock: true },
  { date: '2026-11-09', checkIn: '07.50', checkOut: '17.05', status: 'Hadir', isMock: true },
  { date: '2026-11-10', checkIn: null, checkOut: null, status: 'Sakit', isMock: true },
  { date: '2026-11-11', checkIn: '07.56', checkOut: '17.01', status: 'Hadir', isMock: true },
  { date: '2026-11-12', checkIn: '08.07', checkOut: '17.10', status: 'Terlambat', isMock: true },
  { date: '2026-11-13', checkIn: '07.48', checkOut: '16.58', status: 'Hadir', isMock: true },
  { date: '2026-11-16', checkIn: null, checkOut: null, status: 'Cuti', isMock: true },
  { date: '2026-11-17', checkIn: '07.52', checkOut: '17.04', status: 'Hadir', isMock: true },
]
