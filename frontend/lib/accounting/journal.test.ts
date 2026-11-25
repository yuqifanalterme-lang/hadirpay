import assert from 'node:assert/strict'
import test from 'node:test'
import { createManualJournal, createPayrollAccrualJournal, createPayrollPaymentJournal } from './journal'
import { mockPayrollPeriod, type PayrollLine } from '../mock/payroll'

const sampleLine: PayrollLine = {
  employeeId: 'HP-0001',
  employeeName: 'Budi Santoso',
  position: 'Staf',
  department: 'Gudang',
  initials: 'BS',
  payrollType: 'bulanan',
  employeeCount: 1,
  baseSalary: 4_500_000,
  fixedAllowance: 220_000,
  totalDeductions: 469_545.45,
  netPay: 4_375_454.55,
  workDays: 22,
  presentDays: 21,
  lateCount: 1,
  absenceDays: 1,
  earnings: [],
  deductions: [],
  statutoryDeductions: { incomeTax: 85_000, bpjs: 160_000 },
  isAggregate: false,
  isMock: true,
}

function expectBalanced(journal: ReturnType<typeof createPayrollAccrualJournal>) {
  const debit = journal.lines.reduce((sum, line) => sum + line.debit, 0)
  const credit = journal.lines.reduce((sum, line) => sum + line.credit, 0)
  assert.equal(debit, credit)
}

test('membentuk jurnal pengakuan gaji yang seimbang dan terhubung ke periode', () => {
  const journal = createPayrollAccrualJournal(mockPayrollPeriod, [sampleLine], '2026-11-18')

  expectBalanced(journal)
  assert.equal(journal.type, 'Otomatis')
  assert.equal(journal.sourcePeriodId, mockPayrollPeriod.id)
  assert.deepEqual(
    journal.lines.map(({ accountCode }) => accountCode),
    ['5-1100', '2-1100', '2-1200', '2-1300'],
  )
  assert.deepEqual(
    journal.lines.map(({ accountName, debit, credit }) => [accountName, debit, credit]),
    [
      ['Beban Gaji', 4_620_454.55, 0],
      ['Utang Gaji', 0, 4_375_454.55],
      ['Utang PPh 21', 0, 85_000],
      ['Utang Iuran BPJS', 0, 160_000],
    ],
  )
})

test('membentuk jurnal pembayaran dengan mendebit utang gaji dan mengkredit kas/bank', () => {
  const journal = createPayrollPaymentJournal(mockPayrollPeriod, [sampleLine], '2026-11-25')

  expectBalanced(journal)
  assert.deepEqual(
    journal.lines.map(({ accountCode }) => accountCode),
    ['2-1100', '1-1100'],
  )
  assert.deepEqual(
    journal.lines.map(({ accountName, debit, credit }) => [accountName, debit, credit]),
    [
      ['Utang Gaji', 4_375_454.55, 0],
      ['Kas/Bank', 0, 4_375_454.55],
    ],
  )
})

test('menolak jurnal dengan nominal gaji yang tidak valid', () => {
  assert.throws(
    () => createPayrollPaymentJournal(mockPayrollPeriod, [{ ...sampleLine, netPay: -1 }], '2026-11-25'),
    RangeError,
  )
})

test('jurnal manual mendebit dan mengkredit akun dengan nominal yang sama', () => {
  const journal = createManualJournal({
    id: 'manual-20261118-001',
    date: '2026-11-18',
    voucherNumber: 'JM-20261118-001',
    description: 'Pencatatan saldo kas demo',
    debitAccountCode: '1-1100',
    creditAccountCode: '2-1200',
    amount: 1_250_000,
  })

  assert.equal(journal.type, 'Manual')
  assert.equal(journal.lines[0].debit, journal.lines[1].credit)
})

test('menolak jurnal manual dengan akun yang sama dan tanggal tidak valid', () => {
  assert.throws(
    () => createManualJournal({
      id: 'manual-20261118-002',
      date: '2026-11-18',
      voucherNumber: 'JM-20261118-002',
      description: 'Jurnal demo',
      debitAccountCode: '1-1100',
      creditAccountCode: '1-1100',
      amount: 100,
    }),
    Error,
  )
  assert.throws(
    () => createManualJournal({
      id: 'manual-20261118-003',
      date: '2026-02-31',
      voucherNumber: 'JM-20261118-003',
      description: 'Jurnal demo',
      debitAccountCode: '1-1100',
      creditAccountCode: '2-1200',
      amount: 100,
    }),
    RangeError,
  )
})
