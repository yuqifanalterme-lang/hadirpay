import type { AttendanceStatus } from '@/lib/mock-data'

export type PayrollType = 'bulanan' | 'harian'
export type EmployeeStatus = 'Aktif' | 'Nonaktif'

export type EmployeeSalaryComponent = {
  id: number | string
  code: string
  name: string
  type: 'pendapatan' | 'potongan'
  method: 'nominal_tetap' | 'persen' | 'per_hari' | 'per_menit'
  value: number
}

export type Employee = {
  id: string
  code?: string
  name: string
  position: string
  department: string
  startedAt: string
  payrollType: PayrollType
  baseSalary: number
  fixedAllowance: number
  pph21?: number
  bpjsPercent?: number
  overtimeDeduction?: number
  salaryComponents?: EmployeeSalaryComponent[]
  npwp?: string
  noBpjs?: string
  bpjsKesehatan?: string
  bpjsKetenagakerjaan?: string
  status: EmployeeStatus
  isMock: boolean
}

export type AttendanceRecord = {
  date: string
  checkIn: string
  checkOut: string
  status: AttendanceStatus
}

export type EmployeePayslip = {
  period: string
  issuedAt: string
  net: number
}

export type EmployeeHistory = {
  attendance: AttendanceRecord[]
  payslips: EmployeePayslip[]
}

export const mockEmployees: Employee[] = [
  {
    id: 'HP-0001',
    code: 'KRY-0001',
    name: 'Rina Kartika',
    position: 'Admin HRD',
    department: 'HRD',
    startedAt: '2019-01-01',
    payrollType: 'bulanan',
    baseSalary: 5500000,
    fixedAllowance: 245000,
    pph21: 35000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0002',
    code: 'KRY-0002',
    name: 'Andi Wijaya',
    position: 'Staf Keuangan',
    department: 'Keuangan',
    startedAt: '2020-06-08',
    payrollType: 'bulanan',
    baseSalary: 4500000,
    fixedAllowance: 275000,
    pph21: 85000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0003',
    code: 'KRY-0003',
    name: 'Dimas Pratama',
    position: 'Staf Keuangan',
    department: 'Keuangan',
    startedAt: '2021-11-15',
    payrollType: 'bulanan',
    baseSalary: 4500000,
    fixedAllowance: 300000,
    pph21: 110000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0004',
    code: 'KRY-0004',
    name: 'Budi Santoso',
    position: 'Staf Gudang',
    department: 'Gudang',
    startedAt: '2022-04-22',
    payrollType: 'bulanan',
    baseSalary: 4500000,
    fixedAllowance: 250000,
    pph21: 62000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0005',
    code: 'KRY-0005',
    name: 'Rudi Hartono',
    position: 'Staf Gudang',
    department: 'Gudang',
    startedAt: '2023-09-01',
    payrollType: 'bulanan',
    baseSalary: 4500000,
    fixedAllowance: 220000,
    pph21: 52000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0006',
    code: 'KRY-0006',
    name: 'Siti Rahmawati',
    position: 'Staf Operasional',
    department: 'Operasional',
    startedAt: '2024-02-08',
    payrollType: 'bulanan',
    baseSalary: 4500000,
    fixedAllowance: 265000,
    pph21: 45000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0007',
    code: 'KRY-0007',
    name: 'Maya Lestari',
    position: 'Staf Pemasaran',
    department: 'Pemasaran',
    startedAt: '2025-07-15',
    payrollType: 'bulanan',
    baseSalary: 4500000,
    fixedAllowance: 230000,
    pph21: 17000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0008',
    code: 'KRY-0008',
    name: 'Ratna Puspita',
    position: 'Staf Pemasaran',
    department: 'Pemasaran',
    startedAt: '2026-12-22',
    payrollType: 'bulanan',
    baseSalary: 4500000,
    fixedAllowance: 280000,
    pph21: 225000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0009',
    code: 'KRY-0009',
    name: 'Agus Saputra',
    position: 'Staf Penjualan',
    department: 'Penjualan',
    startedAt: '2019-05-01',
    payrollType: 'bulanan',
    baseSalary: 4500000,
    fixedAllowance: 240000,
    pph21: 60000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0010',
    code: 'KRY-0010',
    name: 'Dewi Anggraini',
    position: 'Staf IT',
    department: 'IT',
    startedAt: '2020-10-08',
    payrollType: 'bulanan',
    baseSalary: 6500000,
    fixedAllowance: 290000,
    pph21: 86000,
    status: 'Aktif',
    isMock: true,
  },
]

export const mockEmployeeHistory: Record<string, EmployeeHistory> = {
  'HP-0002': {
    attendance: [
      { date: '2026-11-17', checkIn: '07.52', checkOut: '17.00', status: 'Hadir' },
      { date: '2026-11-16', checkIn: '08.05', checkOut: '17.00', status: 'Terlambat' },
      { date: '2026-11-13', checkIn: '07.48', checkOut: '16.58', status: 'Hadir' },
    ],
    payslips: [
      { period: 'November 2026', issuedAt: '30 Nov 2026', net: 4425454.55 },
      { period: 'Oktober 2026', issuedAt: '31 Okt 2026', net: 4375454.55 },
      { period: 'September 2026', issuedAt: '30 Sep 2026', net: 4425454.55 },
    ],
  },
}
