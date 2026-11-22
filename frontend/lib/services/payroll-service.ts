import { calculatePayroll } from '@/lib/payroll/calc'
import {
  mockPayrollComponents,
  mockPayrollInputs,
  mockPayrollPeriod,
  type PayrollComponent,
  type PayrollLine,
  type PayrollPeriod,
  type PayrollPeriodStatus,
} from '@/lib/mock/payroll'
import { adminStats } from '@/lib/mock-data'
import { listEmployees } from '@/lib/services/employee-service'
import type { Role } from '@/lib/navigation'
import { createPayrollAccrualJournal, createPayrollPaymentJournal } from '@/lib/accounting/journal'
import { readAccountingState, writeAccountingState } from './accounting-storage'
import { notifyNotificationsChanged } from './request-events'

const COMPONENTS_KEY = 'hadirpay-payroll-components'

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage.getItem(key)
  if (!stored) return fallback
  return JSON.parse(stored) as T
}

function writeStored<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    throw new Error('Penyimpanan tidak tersedia saat ini.')
  }
  window.localStorage.setItem(key, JSON.stringify(value))
}

export async function listPayrollComponents(): Promise<PayrollComponent[]> {
  return readStored(COMPONENTS_KEY, mockPayrollComponents)
}

export async function savePayrollComponent(
  component: Omit<PayrollComponent, 'isMock'> & { isMock?: true },
): Promise<PayrollComponent[]> {
  if (!component.name.trim() || (component.amount !== null && (!Number.isFinite(component.amount) || component.amount < 0))) {
    throw new Error('Nama dan nilai komponen harus diisi dengan benar.')
  }
  const current = await listPayrollComponents()
  const next = current.some((item) => item.id === component.id)
    ? current.map((item) => item.id === component.id ? { ...component, isMock: true as const } : item)
    : [...current, { ...component, isMock: true as const }]
  writeStored(COMPONENTS_KEY, next)
  return next
}

export async function deletePayrollComponent(id: string): Promise<PayrollComponent[]> {
  const current = await listPayrollComponents()
  const next = current.filter((component) => component.id !== id)
  if (next.length === current.length) throw new Error('Komponen yang dipilih tidak ditemukan.')
  writeStored(COMPONENTS_KEY, next)
  return next
}

export async function getPayrollPeriod(): Promise<PayrollPeriod> {
  const state = readAccountingState()
  const period = { ...mockPayrollPeriod, status: state.payrollStatus }
  if (state.payrollStatus === 'Disetujui' || state.payrollStatus === 'Dibayar') {
    const payrollLines = await listPayrollLines()
    const entries = [...state.entries]
    let changed = false
    const accrualId = `payroll-${period.id}-accrual`
    if (!entries.some((entry) => entry.id === accrualId)) {
      entries.push(createPayrollAccrualJournal(period, payrollLines, todayIsoDate()))
      changed = true
    }
    const paymentId = `payroll-${period.id}-payment`
    if (state.payrollStatus === 'Dibayar' && !entries.some((entry) => entry.id === paymentId)) {
      entries.push(createPayrollPaymentJournal(period, payrollLines, todayIsoDate()))
      changed = true
    }
    if (changed) writeAccountingState({ ...state, entries })
  }
  const status = state.payrollStatus
  return { ...mockPayrollPeriod, status }
}

export async function updatePayrollStatus(
  role: Role,
  action: 'submit' | 'approve' | 'pay',
): Promise<PayrollPeriod> {
  const accountingState = readAccountingState()
  const period = { ...mockPayrollPeriod, status: accountingState.payrollStatus }
  const allowed =
    (action === 'submit' && role === 'admin' && period.status === 'Draft') ||
    (action === 'approve' && role === 'keuangan' && period.status === 'Menunggu validasi keuangan') ||
    (action === 'pay' && role === 'keuangan' && period.status === 'Disetujui')

  if (!allowed) throw new Error('Aksi ini tidak tersedia untuk peran atau status penggajian saat ini.')

  const status: Record<typeof action, PayrollPeriodStatus> = {
    submit: 'Menunggu validasi keuangan',
    approve: 'Disetujui',
    pay: 'Dibayar',
  }
  const entries = [...accountingState.entries]
  if (action === 'approve' || action === 'pay') {
    const payrollLines = await listPayrollLines()
    if (action === 'pay' && !entries.some((entry) => entry.id === `payroll-${period.id}-accrual`)) {
      entries.push(createPayrollAccrualJournal(period, payrollLines, todayIsoDate()))
    }
    const journal = action === 'approve'
      ? createPayrollAccrualJournal(period, payrollLines, todayIsoDate())
      : createPayrollPaymentJournal(period, payrollLines, todayIsoDate())
    if (!entries.some((entry) => entry.id === journal.id)) entries.push(journal)
  }
  writeAccountingState({ ...accountingState, payrollStatus: status[action], entries })
  notifyNotificationsChanged()
  return { ...period, status: status[action] }
}

export async function returnPayrollPeriod(): Promise<void> {
  const accountingState = readAccountingState()
  if (accountingState.payrollStatus !== 'Menunggu validasi keuangan') {
    throw new Error('Periode hanya dapat dikembalikan saat menunggu validasi keuangan.')
  }
  writeAccountingState({ ...accountingState, payrollStatus: 'Draft' })
  notifyNotificationsChanged()
}

function todayIsoDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function listPayrollLines(): Promise<PayrollLine[]> {
  const employees = (await listEmployees()).filter((employee) => employee.status === 'Aktif')
  const details = employees.flatMap((employee) => {
    const input = mockPayrollInputs[employee.id]
    if (!input) return []

    const calculation = calculatePayroll(input)
    const initials = employee.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    const earnings = [
      { label: 'Gaji pokok', amount: input.baseSalary },
      ...(input.fixedAllowance > 0 ? [{ label: 'Tunjangan tetap', amount: input.fixedAllowance }] : []),
      ...(input.overtimePay > 0 ? [{ label: 'Upah lembur', amount: input.overtimePay }] : []),
    ]
    const deductions = [
      ...(calculation.absenceDeduction > 0 ? [{ label: `Potongan alpha (${input.absenceDays} hari)`, amount: calculation.absenceDeduction }] : []),
      ...(input.lateDeduction > 0 ? [{ label: 'Potongan keterlambatan', amount: input.lateDeduction }] : []),
      ...(input.otherDeductions > 0 ? [{ label: 'BPJS dan PPh 21', amount: input.otherDeductions }] : []),
    ]

    return [{
      employeeId: employee.id,
      employeeName: employee.name,
      position: employee.position,
      department: employee.department,
      initials,
      payrollType: employee.payrollType,
      employeeCount: 1,
      baseSalary: input.baseSalary,
      fixedAllowance: input.fixedAllowance,
      overtimePay: input.overtimePay,
      totalEarnings: input.baseSalary + input.fixedAllowance + input.overtimePay,
      totalDeductions: calculation.totalDeductions,
      netPay: calculation.netPay,
      workDays: input.workDays,
      presentDays: input.workDays - input.absenceDays,
      lateCount: input.lateDeduction > 0 ? 1 : 0,
      absenceDays: input.absenceDays,
      overtimeHours: input.overtimePay > 0 ? 4 : 0,
      earnings,
      deductions,
      statutoryDeductions: {
        incomeTax: input.incomeTaxDeduction,
        bpjs: input.bpjsDeduction,
      },
      isAggregate: false,
      isMock: true as const,
    }]
  })

  const detailTotal = details.reduce((total, line) => total + line.netPay, 0)
  const aggregateCount = Math.max(mockPayrollPeriod.employeeCount - details.length, 0)
  const aggregateNet = Math.round((adminStats.totalGaji - detailTotal) * 100) / 100
  const aggregate: PayrollLine | null = aggregateCount > 0
    ? {
        employeeId: 'agregat-karyawan-demo',
        employeeName: `${aggregateCount} karyawan lainnya (data agregat)`,
        position: 'Rincian individu belum tersedia',
        department: 'Berbagai departemen',
        initials: '…',
        payrollType: 'bulanan',
        employeeCount: aggregateCount,
        baseSalary: 0,
        fixedAllowance: 0,
        overtimePay: 0,
        totalEarnings: 0,
        totalDeductions: 0,
        netPay: aggregateNet,
        workDays: mockPayrollPeriod.workDays,
        presentDays: 0,
        lateCount: 0,
        absenceDays: 0,
        overtimeHours: 0,
        earnings: [],
        deductions: [],
        isAggregate: true,
        isMock: true,
      }
    : null

  return aggregate ? [...details, aggregate] : details
}
