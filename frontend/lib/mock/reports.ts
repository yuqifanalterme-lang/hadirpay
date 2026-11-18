import { adminStats, recentAttendance } from '@/lib/mock-data'

export type ReportId =
  | 'kehadiran'
  | 'keterlambatan'
  | 'izin-cuti'
  | 'lembur'
  | 'penggajian-bulanan'
  | 'beban-gaji'
  | 'jurnal-penggajian'

export const reportCatalog: {
  id: ReportId
  title: string
  description: string
}[] = [
  { id: 'kehadiran', title: 'Kehadiran', description: 'Ringkasan hadir dan status karyawan per departemen.' },
  { id: 'keterlambatan', title: 'Keterlambatan', description: 'Frekuensi dan total menit keterlambatan karyawan.' },
  { id: 'izin-cuti', title: 'Izin & Cuti', description: 'Daftar pengajuan izin, sakit, dan cuti.' },
  { id: 'lembur', title: 'Lembur', description: 'Jam dan nilai lembur pada periode penggajian.' },
  { id: 'penggajian-bulanan', title: 'Penggajian Bulanan', description: 'Rincian gaji bersih setiap karyawan pada periode.' },
  { id: 'beban-gaji', title: 'Beban Gaji', description: 'Tren biaya gaji bulanan untuk pemantauan.' },
  { id: 'jurnal-penggajian', title: 'Jurnal Umum Penggajian', description: 'Jurnal otomatis yang terbentuk dari proses penggajian.' },
]

export const reportDepartments = [
  'Keuangan',
  'Gudang',
  'HRD',
  'Operasional',
  'Pemasaran',
  'Administrasi',
]

export const mockDepartmentAttendance = [
  { department: 'Keuangan', employees: 6, present: 5, late: 1, permission: 0, sick: 0, leave: 0, absent: 0 },
  { department: 'Gudang', employees: 12, present: 10, late: 1, permission: 0, sick: 0, leave: 0, absent: 1 },
  { department: 'HRD', employees: 5, present: 5, late: 0, permission: 0, sick: 0, leave: 0, absent: 0 },
  { department: 'Operasional', employees: 11, present: 10, late: 1, permission: 0, sick: 0, leave: 0, absent: 0 },
  { department: 'Pemasaran', employees: 8, present: 7, late: 1, permission: 0, sick: 0, leave: 0, absent: 0 },
  { department: 'Administrasi', employees: 6, present: 4, late: 0, permission: 1, sick: 0, leave: 1, absent: 0 },
].map((department) => ({ ...department, isMock: true as const }))

export const mockTardinessLeaderboard = [
  { employeeId: 'HP-0005', employeeName: 'Rudi Hartono', department: 'Gudang', lateDays: 5, lateMinutes: 86 },
  { employeeId: 'HP-0002', employeeName: 'Budi Santoso', department: 'Gudang', lateDays: 4, lateMinutes: 65 },
  { employeeId: 'HP-0009', employeeName: 'Ratna Puspita', department: 'Pemasaran', lateDays: 3, lateMinutes: 42 },
  { employeeId: 'HP-0001', employeeName: 'Andi Wijaya', department: 'Keuangan', lateDays: 2, lateMinutes: 18 },
  { employeeId: 'HP-0007', employeeName: 'Maya Lestari', department: 'Operasional', lateDays: 2, lateMinutes: 12 },
].map((employee) => ({ ...employee, isMock: true as const }))

export const mockPayrollExpenseTrend = [
  { period: '2026-06', label: 'Jun 2026', amount: 172_400_000 },
  { period: '2026-07', label: 'Jul 2026', amount: 174_800_000 },
  { period: '2026-08', label: 'Agu 2026', amount: 178_100_000 },
  { period: '2026-09', label: 'Sep 2026', amount: 181_200_000 },
  { period: '2026-10', label: 'Okt 2026', amount: 183_600_000 },
  { period: '2026-11', label: 'Nov 2026', amount: adminStats.totalGaji },
].map((item) => ({ ...item, isMock: true as const }))

export const demoPaymentDate = '30 Nov 2026'

export const attendanceReportRows = recentAttendance.map((record) => ({
  date: '17 Nov 2026',
  employeeName: record.name,
  department: record.division,
  checkIn: record.checkIn,
  checkOut: record.checkOut,
  status: record.status,
  isMock: true as const,
}))
