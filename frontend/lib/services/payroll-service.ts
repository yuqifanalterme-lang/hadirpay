import { calculatePayroll } from '@/lib/payroll/calc'
import {
  mockPayrollComponents,
  mockPayrollInputs,
  mockPayrollPeriod,
  type PayrollComponent,
  type PayrollLine,
  type PayrollManualComponent,
  type PayrollManualComponentKind,
  type PayrollPeriod,
  type PayrollPeriodStatus,
} from '@/lib/mock/payroll'
import { adminStats } from '@/lib/mock-data'
import { listEmployees } from '@/lib/services/employee-service'
import type { Role } from '@/lib/navigation'
import { createPayrollAccrualJournal, createPayrollPaymentJournal } from '@/lib/accounting/journal'
import { readAccountingState, writeAccountingState } from './accounting-storage'
import { notifyNotificationsChanged } from './request-events'

const COMPONENTS_KEY = 'hadirpay-payroll-components-v2'
const MANUAL_PAYROLL_COMPONENTS_KEY = 'hadirpay-manual-payroll-components-v1'

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage.getItem(key)
  if (!stored) return fallback
  return JSON.parse(stored) as T
}

export async function saveManualPayrollComponents(
  employeeId: string,
  components: PayrollManualComponent[],
): Promise<void> {
  if (readAccountingState().payrollStatus !== 'Draft') {
    throw new Error('Komponen manual hanya dapat diubah saat periode berstatus Draf.')
  }

  const allowedKinds: PayrollManualComponentKind[] = [
    'lembur',
    'potongan_lain',
    'penyesuaian_pendapatan',
    'penyesuaian_potongan',
  ]
  if (components.some((item) =>
    !allowedKinds.includes(item.jenis)
    || !Number.isFinite(item.jumlah)
    || item.jumlah <= 0
    || !item.catatan.trim()
    || item.catatan.trim().length > 150
  )) {
    throw new Error('Setiap komponen harus memiliki jumlah lebih dari nol dan catatan maksimal 150 karakter.')
  }

  const lines = await listPayrollLines()
  const line = lines.find((item) => item.employeeId === employeeId && !item.isAggregate)
  if (!line) throw new Error('Rincian penggajian karyawan tidak ditemukan.')
  const current = line.manualComponents ?? []
  const incomeKinds = new Set<PayrollManualComponentKind>(['lembur', 'penyesuaian_pendapatan'])
  const currentIncome = current.reduce((sum, item) => sum + (incomeKinds.has(item.jenis) ? item.jumlah : 0), 0)
  const currentDeduction = current.reduce((sum, item) => sum + (incomeKinds.has(item.jenis) ? 0 : item.jumlah), 0)
  const nextIncome = components.reduce((sum, item) => sum + (incomeKinds.has(item.jenis) ? item.jumlah : 0), 0)
  const nextDeduction = components.reduce((sum, item) => sum + (incomeKinds.has(item.jenis) ? 0 : item.jumlah), 0)
  if (line.netPay - currentIncome + currentDeduction + nextIncome - nextDeduction < 0) {
    throw new Error('Total potongan melebihi pendapatan. Sesuaikan komponen manual sebelum menyimpan.')
  }

  const saved = readStored<Record<string, PayrollManualComponent[]>>(MANUAL_PAYROLL_COMPONENTS_KEY, {})
  saved[employeeId] = components.map((item) => ({ ...item, catatan: item.catatan.trim() }))
  writeStored(MANUAL_PAYROLL_COMPONENTS_KEY, saved)
}

function writeStored<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    throw new Error('Penyimpanan tidak tersedia saat ini.')
  }
  window.localStorage.setItem(key, JSON.stringify(value))
}

export async function listPayrollComponents(): Promise<PayrollComponent[]> {
  return readStored<PayrollComponent[]>(COMPONENTS_KEY, mockPayrollComponents)
    .filter((component) => component.code !== 'LEMBUR' && component.id !== 'upah-lembur')
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
  const payrollLines = await listPayrollLines()
  const period = {
    ...mockPayrollPeriod,
    status: state.payrollStatus,
    employeeCount: payrollLines.reduce((count, line) => count + line.employeeCount, 0),
    totalEarnings: payrollLines.filter((line) => !line.isAggregate).reduce((total, line) => total + (line.totalEarnings ?? 0), 0),
    totalDeductions: payrollLines.filter((line) => !line.isAggregate).reduce((total, line) => total + line.totalDeductions, 0),
    totalNetPay: payrollLines.reduce((total, line) => total + line.netPay, 0),
  }
  if (state.payrollStatus === 'Disetujui' || state.payrollStatus === 'Dibayar') {
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
  const payrollLines = await listPayrollLines()
  const period = {
    ...mockPayrollPeriod,
    status: accountingState.payrollStatus,
    employeeCount: payrollLines.reduce((count, line) => count + line.employeeCount, 0),
    totalEarnings: payrollLines.filter((line) => !line.isAggregate).reduce((total, line) => total + (line.totalEarnings ?? 0), 0),
    totalDeductions: payrollLines.filter((line) => !line.isAggregate).reduce((total, line) => total + line.totalDeductions, 0),
    totalNetPay: payrollLines.reduce((total, line) => total + line.netPay, 0),
  }
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
  const manualByEmployee = readStored<Record<string, PayrollManualComponent[]>>(MANUAL_PAYROLL_COMPONENTS_KEY, {})
  const details = employees.flatMap((employee) => {
    const savedInput = mockPayrollInputs[employee.id] ?? {
      workDays: mockPayrollPeriod.workDays,
      absenceDays: 0,
      lateDeduction: 0,
      otherDeductions: 0,
      incomeTaxDeduction: employee.pph21 ?? 0,
    }
    const input = {
      ...savedInput,
      baseSalary: employee.baseSalary,
      fixedAllowance: employee.fixedAllowance,
    }

    const incomeTax = employee.pph21 ?? input.incomeTaxDeduction
    const bpjsRate = employee.bpjsPercent ?? 3
    const bpjs = Math.round(input.baseSalary * bpjsRate / 100 * 100) / 100
    const additionalEarnings: { label: string; amount: number }[] = []
    const additionalDeductions: { label: string; amount: number }[] = []
    const manualComponents = manualByEmployee[employee.id] ?? []
    for (const component of employee.salaryComponents ?? []) {
      if (!component.code || ['BPJS', 'PPH21', 'TUN-TRANSPORT', 'POT-LEMBUR'].includes(component.code)) continue
      const amount = component.method === 'nominal_tetap'
        ? component.value
        : component.method === 'persen'
          ? input.baseSalary * component.value / 100
          : component.method === 'per_hari'
            ? Math.max(input.workDays - input.absenceDays, 0) * component.value
            : (input.lateMinutes ?? 0) * component.value
      const roundedAmount = Math.round(amount * 100) / 100
      if (roundedAmount <= 0) continue
      const item = { label: component.name, amount: roundedAmount }
      if (component.type === 'pendapatan') additionalEarnings.push(item)
      else additionalDeductions.push(item)
    }
    if ((employee.overtimeDeduction ?? 0) > 0) {
      additionalDeductions.push({
        label: 'Potongan lembur',
        amount: Math.round((employee.overtimeDeduction ?? 0) * 100) / 100,
      })
    }
    const manualLabels: Record<PayrollManualComponentKind, string> = {
      lembur: 'Pendapatan Lembur',
      potongan_lain: 'Potongan Lain',
      penyesuaian_pendapatan: 'Penyesuaian Pendapatan',
      penyesuaian_potongan: 'Penyesuaian Potongan',
    }
    for (const component of manualComponents) {
      const item = { label: manualLabels[component.jenis], amount: component.jumlah }
      if (component.jenis === 'lembur' || component.jenis === 'penyesuaian_pendapatan') {
        additionalEarnings.push(item)
      } else {
        additionalDeductions.push(item)
      }
    }
    const calculation = calculatePayroll({
      ...input,
      otherDeductions: incomeTax + bpjs + additionalDeductions.reduce((sum, item) => sum + item.amount, 0),
    })
    const initials = employee.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    const earnings = [
      { label: 'Gaji pokok', amount: input.baseSalary },
      ...(input.fixedAllowance > 0 ? [{ label: 'Tunjangan tetap', amount: input.fixedAllowance }] : []),
      ...additionalEarnings,
    ]
    const deductions = [
      ...(calculation.absenceDeduction > 0 ? [{ label: `Potongan alpha (${input.absenceDays} hari)`, amount: calculation.absenceDeduction }] : []),
      ...(input.lateDeduction > 0 ? [{ label: 'Potongan keterlambatan', amount: input.lateDeduction }] : []),
      ...(bpjs > 0 ? [{ label: `Iuran BPJS (${bpjsRate}%)`, amount: bpjs }] : []),
      ...(incomeTax > 0 ? [{ label: 'PPh 21', amount: incomeTax }] : []),
      ...additionalDeductions,
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
      totalEarnings: input.baseSalary + input.fixedAllowance + additionalEarnings.reduce((sum, item) => sum + item.amount, 0),
      totalDeductions: calculation.totalDeductions,
      netPay: Math.round((calculation.netPay + additionalEarnings.reduce((sum, item) => sum + item.amount, 0)) * 100) / 100,
      workDays: input.workDays,
      presentDays: input.workDays - input.absenceDays,
      lateCount: input.lateDeduction > 0 ? 1 : 0,
      absenceDays: input.absenceDays,
      earnings,
      deductions,
      manualComponents,
      statutoryDeductions: {
        incomeTax,
        bpjs,
        otherDeductions: additionalDeductions.reduce((sum, item) => sum + item.amount, 0),
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
        totalEarnings: 0,
        totalDeductions: 0,
        netPay: aggregateNet,
        workDays: mockPayrollPeriod.workDays,
        presentDays: 0,
        lateCount: 0,
        absenceDays: 0,
        earnings: [],
        deductions: [],
        isAggregate: true,
        isMock: true,
      }
    : null

  return aggregate ? [...details, aggregate] : details
}
