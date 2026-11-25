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
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  const hasDecimals = !Number.isInteger(rounded)
  return `Rp${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rounded)}`
}

export function formatRupiahDecimal(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) throw new RangeError('Nominal harus berupa angka dengan maksimal dua desimal.')

  const integer = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fraction = (match[3] ?? '').padEnd(2, '0')
  return `Rp${match[1]}${integer}${fraction === '00' ? '' : `,${fraction}`}`
}

export const adminUser = { name: 'Rina Kartika', role: 'Admin HRD', initials: 'RK' }
export const employeeUser = { name: 'Andi Wijaya', role: 'Staf Keuangan', initials: 'AW' }

export const adminStats = {
  totalKaryawan: 10,
  hadir: 7,
  terlambat: 1,
  tidakHadir: 2,
  totalGaji: 51125000,
}

export const attendanceTrend = [
  { day: 'Sen 9', hadir: 8, tepatWaktu: 7 },
  { day: 'Sel 10', hadir: 9, tepatWaktu: 8 },
  { day: 'Rab 11', hadir: 8, tepatWaktu: 7 },
  { day: 'Kam 12', hadir: 8, tepatWaktu: 7 },
  { day: 'Jum 13', hadir: 7, tepatWaktu: 6 },
  { day: 'Sen 16', hadir: 9, tepatWaktu: 8 },
  { day: 'Sel 17', hadir: 7, tepatWaktu: 6 },
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
  { name: 'Siti Rahmawati', division: 'Operasional', checkIn: '—', checkOut: '—', status: 'Izin' },
  { name: 'Rina Kartika', division: 'HRD', checkIn: '07.45', checkOut: '—', status: 'Hadir' },
  { name: 'Maya Lestari', division: 'Pemasaran', checkIn: '—', checkOut: '—', status: 'Cuti' },
  { name: 'Agus Saputra', division: 'Penjualan', checkIn: '—', checkOut: '—', status: 'Alpha' },
]

export const payslip = {
  periode: 'Oktober 2026',
  issued: '31 Okt 2026',
  earnings: [
    { label: 'Gaji pokok', amount: 4500000 },
    { label: 'Tunjangan makan & transport', amount: 245000 },
    { label: 'Lembur (4 jam)', amount: 125000 },
  ],
  deductions: [
    { label: 'Potongan absen (1 hari alpha)', amount: 204545.45 },
    { label: 'Potongan keterlambatan', amount: 20000 },
    { label: 'Iuran BPJS (3%)', amount: 135000 },
    { label: 'PPh 21', amount: 85000 },
  ],
  net: 4425454.55,
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
