import type { PayrollCalculationInput } from '../payroll/calc'

export type PayrollPeriodStatus =
  | 'Draft'
  | 'Menunggu validasi keuangan'
  | 'Disetujui'
  | 'Dibayar'

export type PayrollComponentCategory = 'pendapatan' | 'potongan'
export type PayrollComponentMethod = 'nominal tetap' | 'persen' | 'per hari' | 'per jam' | 'per menit'

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
  overtimePay: number
  totalEarnings?: number
  totalDeductions: number
  netPay: number
  workDays: number
  presentDays: number
  lateCount: number
  absenceDays: number
  overtimeHours: number
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
  bpjsDeduction: number
}

export const mockPayrollPeriod: PayrollPeriod = {
  id: payrollPeriodId,
  period: 'November 2026',
  cutoffDate: '25 Nov 2026',
  workDays: 22,
  employeeCount: 48,
  totalNetPay: 186_450_000,
  status: 'Draft',
  isMock: true,
}

export const mockPayrollComponents: PayrollComponent[] = [
  { id: 'tunjangan-tetap', name: 'Tunjangan tetap', category: 'pendapatan', method: 'nominal tetap', amount: 220_000, active: true, isMock: true },
  { id: 'upah-lembur', name: 'Upah lembur', category: 'pendapatan', method: 'per hari', amount: 100_000, active: true, isMock: true },
  { id: 'potongan-terlambat', name: 'Potongan keterlambatan', category: 'potongan', method: 'nominal tetap', amount: 20_000, active: true, isMock: true },
  { id: 'potongan-alpha', name: 'Potongan alpha', category: 'potongan', method: 'per hari', amount: 0, active: true, isMock: true },
  { id: 'pph-21', name: 'PPh 21', category: 'potongan', method: 'persen', amount: 1.89, active: true, isMock: true },
  { id: 'bpjs-kesehatan', name: 'BPJS Kesehatan', category: 'potongan', method: 'persen', amount: 1, active: true, isMock: true },
  { id: 'bpjs-ketenagakerjaan', name: 'BPJS Ketenagakerjaan', category: 'potongan', method: 'persen', amount: 2.56, active: true, isMock: true },
]

export const mockPayrollInputs: Record<string, MockPayrollInput> = {
  'HP-0001': { baseSalary: 4_500_000, fixedAllowance: 220_000, overtimePay: 125_000, workDays: 22, absenceDays: 1, lateDeduction: 20_000, otherDeductions: 245_000, incomeTaxDeduction: 85_000, bpjsDeduction: 160_000 },
  'HP-0002': { baseSalary: 4_000_000, fixedAllowance: 150_000, overtimePay: 100_000, workDays: 22, absenceDays: 0, lateDeduction: 20_000, otherDeductions: 180_000, incomeTaxDeduction: 62_000, bpjsDeduction: 118_000 },
  'HP-0003': { baseSalary: 3_900_000, fixedAllowance: 200_000, overtimePay: 0, workDays: 22, absenceDays: 0, lateDeduction: 0, otherDeductions: 130_000, incomeTaxDeduction: 45_000, bpjsDeduction: 85_000 },
  'HP-0004': { baseSalary: 6_500_000, fixedAllowance: 350_000, overtimePay: 200_000, workDays: 22, absenceDays: 0, lateDeduction: 0, otherDeductions: 320_000, incomeTaxDeduction: 110_000, bpjsDeduction: 210_000 },
  'HP-0005': { baseSalary: 4_100_000, fixedAllowance: 150_000, overtimePay: 0, workDays: 22, absenceDays: 0, lateDeduction: 20_000, otherDeductions: 150_000, incomeTaxDeduction: 52_000, bpjsDeduction: 98_000 },
  'HP-0006': { baseSalary: 4_800_000, fixedAllowance: 250_000, overtimePay: 100_000, workDays: 22, absenceDays: 0, lateDeduction: 0, otherDeductions: 250_000, incomeTaxDeduction: 86_000, bpjsDeduction: 164_000 },
  'HP-0007': { baseSalary: 3_960_000, fixedAllowance: 550_000, overtimePay: 0, workDays: 22, absenceDays: 1, lateDeduction: 0, otherDeductions: 50_000, incomeTaxDeduction: 17_000, bpjsDeduction: 33_000 },
  'HP-0008': { baseSalary: 3_630_000, fixedAllowance: 440_000, overtimePay: 0, workDays: 22, absenceDays: 0, lateDeduction: 20_000, otherDeductions: 100_000, incomeTaxDeduction: 35_000, bpjsDeduction: 65_000 },
  'HP-0009': { baseSalary: 7_200_000, fixedAllowance: 500_000, overtimePay: 150_000, workDays: 22, absenceDays: 0, lateDeduction: 0, otherDeductions: 650_000, incomeTaxDeduction: 225_000, bpjsDeduction: 425_000 },
}
