import type { AttendanceStatus } from '@/lib/mock-data'

export type PayrollType = 'bulanan' | 'harian'
export type EmployeeStatus = 'Aktif' | 'Nonaktif'

export type Employee = {
  id: string
  name: string
  position: string
  department: string
  startedAt: string
  payrollType: PayrollType
  baseSalary: number
  fixedAllowance: number
  npwp?: string
  bpjsKesehatan?: string
  bpjsKetenagakerjaan?: string
  status: EmployeeStatus
  isMock: true
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
    name: 'Andi Wijaya',
    position: 'Staf Keuangan',
    department: 'Keuangan',
    startedAt: '2023-02-13',
    payrollType: 'bulanan',
    baseSalary: 4500000,
    fixedAllowance: 220000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0002',
    name: 'Budi Santoso',
    position: 'Staf Gudang',
    department: 'Gudang',
    startedAt: '2022-08-01',
    payrollType: 'bulanan',
    baseSalary: 4000000,
    fixedAllowance: 150000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0003',
    name: 'Siti Rahmawati',
    position: 'Staf Pemasaran',
    department: 'Pemasaran',
    startedAt: '2024-01-15',
    payrollType: 'bulanan',
    baseSalary: 3900000,
    fixedAllowance: 200000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0004',
    name: 'Dimas Pratama',
    position: 'Akuntan',
    department: 'Keuangan',
    startedAt: '2021-11-08',
    payrollType: 'bulanan',
    baseSalary: 6500000,
    fixedAllowance: 350000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0005',
    name: 'Rudi Hartono',
    position: 'Staf Gudang',
    department: 'Gudang',
    startedAt: '2020-07-20',
    payrollType: 'bulanan',
    baseSalary: 4100000,
    fixedAllowance: 150000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0006',
    name: 'Dewi Anggraini',
    position: 'Staf HRD',
    department: 'HRD',
    startedAt: '2023-05-02',
    payrollType: 'bulanan',
    baseSalary: 4800000,
    fixedAllowance: 250000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0007',
    name: 'Maya Lestari',
    position: 'Operator Operasional',
    department: 'Operasional',
    startedAt: '2024-06-10',
    payrollType: 'harian',
    baseSalary: 180000,
    fixedAllowance: 25000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0008',
    name: 'Fajar Nugroho',
    position: 'Staf Gudang',
    department: 'Gudang',
    startedAt: '2022-03-14',
    payrollType: 'harian',
    baseSalary: 165000,
    fixedAllowance: 20000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0009',
    name: 'Ratna Puspita',
    position: 'Supervisor Pemasaran',
    department: 'Pemasaran',
    startedAt: '2020-10-05',
    payrollType: 'bulanan',
    baseSalary: 7200000,
    fixedAllowance: 500000,
    status: 'Aktif',
    isMock: true,
  },
  {
    id: 'HP-0010',
    name: 'Dedi Saputra',
    position: 'Staf Administrasi',
    department: 'Administrasi',
    startedAt: '2023-09-18',
    payrollType: 'bulanan',
    baseSalary: 4200000,
    fixedAllowance: 200000,
    status: 'Nonaktif',
    isMock: true,
  },
]

export const mockEmployeeHistory: Record<string, EmployeeHistory> = {
  'HP-0001': {
    attendance: [
      { date: '2026-11-17', checkIn: '07.52', checkOut: '17.04', status: 'Hadir' },
      { date: '2026-11-16', checkIn: '08.05', checkOut: '17.02', status: 'Terlambat' },
      { date: '2026-11-13', checkIn: '07.48', checkOut: '16.58', status: 'Hadir' },
    ],
    payslips: [
      { period: 'November 2026', issuedAt: '30 Nov 2026', net: 4375454.55 },
      { period: 'Oktober 2026', issuedAt: '31 Okt 2026', net: 4325454.55 },
      { period: 'September 2026', issuedAt: '30 Sep 2026', net: 4375454.55 },
    ],
  },
}
