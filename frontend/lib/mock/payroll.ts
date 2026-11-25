import type { PayrollCalculationInput } from '../payroll/calc'

export type PayrollPeriodStatus =
  | 'Draft'
  | 'Menunggu validasi keuangan'
  | 'Disetujui'
  | 'Dibayar'
  | 'Dibatalkan'

export type PayrollComponentCategory = 'pendapatan' | 'potongan'
export type PayrollComponentMethod = 'nominal tetap' | 'persen' | 'per hari' | 'per menit'

export type PayrollComponent = {
  id: string
  code?: string
  name: string
  category: PayrollComponentCategory
  method: PayrollComponentMethod
  amount: number | null
  description?: string | null
  active: boolean
  isMock: boolean
}

export type PayrollPeriod = {
  id: string
  period: string
  cutoffDate: string
  workDays: number
  employeeCount: number
  totalNetPay: number
  status: PayrollPeriodStatus
  closed?: boolean
  isMock: boolean
}

export type PayrollBreakdownItem = {
  label: string
  amount: number
}

export type PayrollLine = {
  employeeId: string
  employeeName: string
  position: string
  department: string
  initials: string
  payrollType: 'bulanan' | 'harian'
  employeeCount: number
  baseSalary: number
  fixedAllowance: number
  totalEarnings?: number
  totalDeductions: number
  netPay: number
  workDays: number
  presentDays: number
  lateCount: number
  absenceDays: number
  earnings: PayrollBreakdownItem[]
  deductions: PayrollBreakdownItem[]
  statutoryDeductions?: {
    incomeTax: number
    bpjs: number
  }
  isAggregate: boolean
  isMock: boolean
}

export const payrollPeriodId = '2026-11'

type MockPayrollInput = PayrollCalculationInput & {
  incomeTaxDeduction: number
}

export const mockPayrollPeriod: PayrollPeriod = {
  id: payrollPeriodId,
  period: 'November 2026',
  cutoffDate: '25 Nov 2026',
  workDays: 22,
  employeeCount: 10,
  totalNetPay: 48_418_909.1,
  status: 'Draft',
  isMock: true,
}

export const mockPayrollComponents: PayrollComponent[] = [
  { id: 'tunjangan-tetap', name: 'Tunjangan transport', category: 'pendapatan', method: 'nominal tetap', amount: 245_000, active: true, isMock: true },
  { id: 'potongan-terlambat', name: 'Potongan keterlambatan', category: 'potongan', method: 'nominal tetap', amount: 20_000, active: true, isMock: true },
  { id: 'potongan-alpha', name: 'Potongan alpha', category: 'potongan', method: 'per hari', amount: 0, active: true, isMock: true },
  { id: 'pph-21', code: 'PPH21', name: 'PPh 21 per karyawan', category: 'potongan', method: 'nominal tetap', amount: null, description: 'Diinput pada profil karyawan', active: true, isMock: true },
  { id: 'bpjs', code: 'BPJS', name: 'Iuran BPJS', category: 'potongan', method: 'persen', amount: 3, description: 'Total 3% dari gaji pokok', active: true, isMock: true },
]

export const mockPayrollInputs: Record<string, MockPayrollInput> = {
  'HP-0001': { baseSalary: 5_500_000, fixedAllowance: 245_000, workDays: 22, absenceDays: 0, lateDeduction: 0, otherDeductions: 0, incomeTaxDeduction: 35_000 },
  'HP-0002': { baseSalary: 4_500_000, fixedAllowance: 275_000, workDays: 22, absenceDays: 1, lateDeduction: 20_000, otherDeductions: 0, incomeTaxDeduction: 85_000 },
  'HP-0003': { baseSalary: 4_500_000, fixedAllowance: 300_000, workDays: 22, absenceDays: 0, lateDeduction: 0, otherDeductions: 0, incomeTaxDeduction: 110_000 },
  'HP-0004': { baseSalary: 4_500_000, fixedAllowance: 250_000, workDays: 22, absenceDays: 0, lateDeduction: 20_000, otherDeductions: 0, incomeTaxDeduction: 62_000 },
  'HP-0005': { baseSalary: 4_500_000, fixedAllowance: 220_000, workDays: 22, absenceDays: 0, lateDeduction: 20_000, otherDeductions: 0, incomeTaxDeduction: 52_000 },
  'HP-0006': { baseSalary: 4_500_000, fixedAllowance: 265_000, workDays: 22, absenceDays: 0, lateDeduction: 0, otherDeductions: 0, incomeTaxDeduction: 45_000 },
  'HP-0007': { baseSalary: 4_500_000, fixedAllowance: 230_000, workDays: 22, absenceDays: 1, lateDeduction: 0, otherDeductions: 0, incomeTaxDeduction: 17_000 },
  'HP-0008': { baseSalary: 4_500_000, fixedAllowance: 280_000, workDays: 22, absenceDays: 0, lateDeduction: 20_000, otherDeductions: 0, incomeTaxDeduction: 225_000 },
  'HP-0009': { baseSalary: 4_500_000, fixedAllowance: 240_000, workDays: 22, absenceDays: 0, lateDeduction: 0, otherDeductions: 0, incomeTaxDeduction: 60_000 },
  'HP-0010': { baseSalary: 6_500_000, fixedAllowance: 290_000, workDays: 22, absenceDays: 0, lateDeduction: 0, otherDeductions: 0, incomeTaxDeduction: 86_000 },
}
