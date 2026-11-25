import {
  mockAccounts,
  type AccountingAccount,
  type JournalEntry,
  type JournalLine,
} from '../mock/accounting'
import type { PayrollLine, PayrollPeriod } from '../mock/payroll'

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function getAccount(code: string, accounts: AccountingAccount[] = mockAccounts): AccountingAccount {
  const account = accounts.find((item) => item.code === code)
  if (!account) throw new Error(`Akun ${code} tidak ditemukan.`)
  return account
}

function makeLine(
  accountCode: string,
  debit: number,
  credit: number,
  accounts: AccountingAccount[] = mockAccounts,
): JournalLine {
  const account = getAccount(accountCode, accounts)
  return {
    accountCode,
    accountName: account.name,
    debit: roundMoney(debit),
    credit: roundMoney(credit),
  }
}

function assertDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new RangeError('Tanggal jurnal harus menggunakan format YYYY-MM-DD.')
  }
}

function createBalancedEntry({
  id,
  date,
  voucherNumber,
  description,
  type,
  sourcePeriod,
  lines,
}: {
  id: string
  date: string
  voucherNumber: string
  description: string
  type: JournalEntry['type']
  sourcePeriod: PayrollPeriod | null
  lines: JournalLine[]
}): JournalEntry {
  assertDate(date)
  const nonZeroLines = lines.filter((line) => line.debit !== 0 || line.credit !== 0)
  if (nonZeroLines.length < 2) throw new RangeError('Jurnal harus memiliki sedikitnya dua baris bernilai.')
  if (nonZeroLines.some((line) =>
    !Number.isFinite(line.debit) ||
    !Number.isFinite(line.credit) ||
    line.debit < 0 ||
    line.credit < 0 ||
    (line.debit > 0 && line.credit > 0),
  )) {
    throw new RangeError('Setiap baris jurnal hanya boleh berisi debit atau kredit yang valid.')
  }

  const totalDebit = roundMoney(nonZeroLines.reduce((sum, line) => sum + line.debit, 0))
  const totalCredit = roundMoney(nonZeroLines.reduce((sum, line) => sum + line.credit, 0))
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new RangeError('Jurnal tidak seimbang. Total debit harus sama dengan kredit.')
  }

  return {
    id,
    date,
    voucherNumber,
    description,
    type,
    sourcePeriodId: sourcePeriod?.id ?? null,
    sourcePeriodLabel: sourcePeriod?.period ?? null,
    lines: nonZeroLines,
    isMock: true,
  }
}

function sumNetPay(lines: PayrollLine[]) {
  if (lines.length === 0) throw new RangeError('Rincian penggajian belum tersedia.')
  const total = lines.reduce((sum, line) => {
    if (!Number.isFinite(line.netPay) || line.netPay < 0) {
      throw new RangeError('Nilai gaji bersih harus berupa angka nol atau lebih.')
    }
    return sum + line.netPay
  }, 0)
  return roundMoney(total)
}

export function createPayrollAccrualJournal(
  period: PayrollPeriod,
  payrollLines: PayrollLine[],
  date: string,
): JournalEntry {
  const netPay = sumNetPay(payrollLines)
  const incomeTax = roundMoney(payrollLines.reduce(
    (sum, line) => sum + (line.statutoryDeductions?.incomeTax ?? 0),
    0,
  ))
  const bpjs = roundMoney(payrollLines.reduce(
    (sum, line) => sum + (line.statutoryDeductions?.bpjs ?? 0),
    0,
  ))
  const lines = [
    makeLine('5-1100', netPay + incomeTax + bpjs, 0),
    makeLine('2-1100', 0, netPay),
    makeLine('2-1200', 0, incomeTax),
    makeLine('2-1300', 0, bpjs),
  ]

  return createBalancedEntry({
    id: `payroll-${period.id}-accrual`,
    date,
    voucherNumber: `JU-${period.id}-GAJI`,
    description: `Pengakuan gaji ${period.period}`,
    type: 'Otomatis',
    sourcePeriod: period,
    lines,
  })
}

export function createPayrollPaymentJournal(
  period: PayrollPeriod,
  payrollLines: PayrollLine[],
  date: string,
): JournalEntry {
  const netPay = sumNetPay(payrollLines)
  const lines = [
    makeLine('2-1100', netPay, 0),
    makeLine('1-1100', 0, netPay),
  ]

  return createBalancedEntry({
    id: `payroll-${period.id}-payment`,
    date,
    voucherNumber: `JU-${period.id}-BAYAR`,
    description: `Pembayaran gaji ${period.period}`,
    type: 'Otomatis',
    sourcePeriod: period,
    lines,
  })
}

export function createManualJournal({
  id,
  date,
  voucherNumber,
  description,
  debitAccountCode,
  creditAccountCode,
  amount,
  accounts,
}: {
  id: string
  date: string
  voucherNumber: string
  description: string
  debitAccountCode: string
  creditAccountCode: string
  amount: number
  accounts?: AccountingAccount[]
}): JournalEntry {
  if (!description.trim()) throw new Error('Keterangan jurnal wajib diisi.')
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('Nominal jurnal harus lebih dari nol.')
  if (debitAccountCode === creditAccountCode) {
    throw new Error('Akun debit dan kredit harus berbeda.')
  }

  return createBalancedEntry({
    id,
    date,
    voucherNumber,
    description: description.trim(),
    type: 'Manual',
    sourcePeriod: null,
    lines: [
      makeLine(debitAccountCode, amount, 0, accounts),
      makeLine(creditAccountCode, 0, amount, accounts),
    ],
  })
}

export function formatAccountingDate(date: string) {
  assertDate(date)
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}
