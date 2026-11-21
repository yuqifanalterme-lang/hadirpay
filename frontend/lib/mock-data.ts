export type AttendanceStatus =
  | 'Hadir'
  | 'Terlambat'
  | 'Alpha'
  | 'Dinas Luar'
  | 'Sakit'
  | 'Izin'
  | 'Cuti'
  | 'Disetujui'
  | 'Menunggu'
  | 'Ditolak'

export function formatRupiah(value: number) {
  const hasDecimals = !Number.isInteger(value)
  return `Rp${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)}`
}

export const adminUser = { name: 'Rina Kartika', role: 'Admin HRD', initials: 'RK' }
export const employeeUser = { name: 'Andi Wijaya', role: 'Staf Keuangan', initials: 'AW' }

export const adminStats = {
  totalKaryawan: 48,
  hadir: 41,
  terlambat: 4,
  tidakHadir: 3,
  totalGaji: 186450000,
}

export const attendanceTrend = [
  { day: 'Sen 9', hadir: 44, tepatWaktu: 40 },
  { day: 'Sel 10', hadir: 46, tepatWaktu: 43 },
  { day: 'Rab 11', hadir: 43, tepatWaktu: 38 },
  { day: 'Kam 12', hadir: 45, tepatWaktu: 42 },
  { day: 'Jum 13', hadir: 42, tepatWaktu: 37 },
  { day: 'Sen 16', hadir: 46, tepatWaktu: 44 },
  { day: 'Sel 17', hadir: 41, tepatWaktu: 37 },
]

export type WeekDay = {
  short: string
  date: string
  state: 'done' | 'today' | 'upcoming'
  note?: string
}

export const adminWeek: WeekDay[] = [
  { short: 'SEN', date: '16 Nov', state: 'done', note: '96%' },
  { short: 'SEL', date: '17 Nov', state: 'today', note: '85%' },
  { short: 'RAB', date: '18 Nov', state: 'upcoming' },
  { short: 'KAM', date: '19 Nov', state: 'upcoming' },
  { short: 'JUM', date: '20 Nov', state: 'upcoming' },
]

export type AttendanceRow = {
  name: string
  division: string
  checkIn: string
  checkOut: string
  status: AttendanceStatus
}

export const recentAttendance: AttendanceRow[] = [
  { name: 'Andi Wijaya', division: 'Keuangan', checkIn: '07.52', checkOut: '—', status: 'Hadir' },
  { name: 'Rudi Hartono', division: 'Gudang', checkIn: '08.17', checkOut: '—', status: 'Terlambat' },
  { name: 'Siti Rahmawati', division: 'Pemasaran', checkIn: '—', checkOut: '—', status: 'Izin' },
  { name: 'Dewi Anggraini', division: 'HRD', checkIn: '07.45', checkOut: '—', status: 'Hadir' },
  { name: 'Maya Lestari', division: 'Operasional', checkIn: '—', checkOut: '—', status: 'Cuti' },
  { name: 'Fajar Nugroho', division: 'Gudang', checkIn: '—', checkOut: '—', status: 'Alpha' },
]

export const payslip = {
  periode: 'Oktober 2026',
  issued: '31 Okt 2026',
  earnings: [
    { label: 'Gaji pokok', amount: 4500000 },
    { label: 'Tunjangan makan & transport', amount: 220000 },
    { label: 'Lembur (4 jam)', amount: 125000 },
  ],
  deductions: [
    { label: 'Potongan absen (1 hari alpha)', amount: 204545.45 },
    { label: 'BPJS Kesehatan (1%)', amount: 45000 },
    { label: 'BPJS Ketenagakerjaan (3%)', amount: 135000 },
    { label: 'PPh 21', amount: 85000 },
  ],
  net: 4375454.55,
}

export const journalEntries = [
  { date: '31 Okt 2026', account: 'Beban Gaji', code: '6-1100', debit: 186450000, credit: 0 },
  { date: '31 Okt 2026', account: 'Utang PPh 21', code: '2-1300', debit: 0, credit: 4120000 },
  { date: '31 Okt 2026', account: 'Utang BPJS', code: '2-1400', debit: 0, credit: 7458000 },
  { date: '31 Okt 2026', account: 'Kas di Bank', code: '1-1200', debit: 0, credit: 174872000 },
]

export const latestRequest = {
  type: 'Cuti tahunan',
  date: '24 Nov 2026',
  submitted: '12 Nov 2026',
  status: 'Disetujui' as AttendanceStatus,
  approver: 'Rina Kartika (HRD)',
}
