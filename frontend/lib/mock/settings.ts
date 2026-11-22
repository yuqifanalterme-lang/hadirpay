import type { Role } from '@/lib/navigation'

export type WorkingDay = 'senin' | 'selasa' | 'rabu' | 'kamis' | 'jumat' | 'sabtu' | 'minggu'

export type DemoUser = {
  id: string
  name: string
  email: string
  role: Role
  active?: boolean
}

export type DemoSettings = {
  company: {
    name: string
    address: string
    npwp: string
    logoDataUrl?: string
    logoUrl?: string
  }
  workSchedule: {
    startTime: string
    endTime: string
    lateToleranceMinutes: number
    workDays: WorkingDay[]
    holidays: { date: string; name: string }[]
    annualLeaveQuota: number
  }
  payrollPolicy: {
    absenceDeductionMethod: 'per_day' | 'fixed'
    absenceDeductionAmount: number
    apiAbsenceDeductionMethod?: string
    workDayDivisor: string
    deductPermitWithoutLetter: boolean
    overtimeRatePerHour: number
    cutoffDay: number
  }
  users: DemoUser[]
  attendanceLocation: {
    enabled: boolean
    name: string
    address: string
    radiusMeters: number
  }
  apiAttendanceLocations?: {
    id: string | number
    nama: string
    alamat: string
    latitude: number
    longitude: number
    radius_meter: number
    wajib_lokasi: boolean
  }[]
}

export const workingDayOptions: { value: WorkingDay; label: string }[] = [
  { value: 'senin', label: 'Senin' },
  { value: 'selasa', label: 'Selasa' },
  { value: 'rabu', label: 'Rabu' },
  { value: 'kamis', label: 'Kamis' },
  { value: 'jumat', label: 'Jumat' },
  { value: 'sabtu', label: 'Sabtu' },
  { value: 'minggu', label: 'Minggu' },
]

export const mockSettings: DemoSettings = {
  company: {
    name: 'HADIRPAY',
    address: 'Jakarta, Indonesia',
    npwp: '',
  },
  workSchedule: {
    startTime: '08:00',
    endTime: '17:00',
    lateToleranceMinutes: 0,
    workDays: ['senin', 'selasa', 'rabu', 'kamis', 'jumat'],
    holidays: [],
    annualLeaveQuota: 0,
  },
  payrollPolicy: {
    absenceDeductionMethod: 'per_day',
    absenceDeductionAmount: 0,
    workDayDivisor: '',
    deductPermitWithoutLetter: false,
    overtimeRatePerHour: 25000,
    cutoffDay: 25,
  },
  users: [
    { id: 'user-rina', name: 'Rina Kartika', email: 'rina.hrd@hadirpay.id', role: 'admin' },
    { id: 'user-andi-finance', name: 'Andi Wijaya', email: 'andi.wijaya@hadirpay.id', role: 'keuangan' },
    { id: 'user-andi-employee', name: 'Andi Wijaya', email: 'andi.wijaya@hadirpay.id', role: 'karyawan' },
    { id: 'user-owner', name: 'Pemilik', email: 'pemilik@contoh.id', role: 'pemilik' },
  ],
  attendanceLocation: {
    enabled: false,
    name: 'Kantor HADIRPAY',
    address: 'Jakarta, Indonesia',
    radiusMeters: 200,
  },
}
