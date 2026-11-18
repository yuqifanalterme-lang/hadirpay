import { mockAccounts } from '@/lib/mock/accounting'
import type { AccountingAccount, JournalEntry } from '@/lib/mock/accounting'
import { createManualJournal } from '@/lib/accounting/journal'
import { readAccountingState, writeAccountingState } from './accounting-storage'
import { getPayrollPeriod } from './payroll-service'

export type LedgerMovement = {
  entry: JournalEntry
  debit: number
  credit: number
  runningBalance: number
}

export type LedgerReport = {
  openingBalance: number
  movements: LedgerMovement[]
  closingBalance: number
}

export type TrialBalanceRow = {
  account: AccountingAccount
  debit: number
  credit: number
}

export type TrialBalanceReport = {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
  hasTransactions: boolean
}

function validatePeriod(period: string) {
  const month = Number(period.slice(5, 7))
  if (!/^\d{4}-\d{2}$/.test(period) || month < 1 || month > 12) {
    throw new Error('Periode harus menggunakan format YYYY-MM dengan bulan yang valid.')
  }
}

export async function listAccounts() {
  return mockAccounts
}

export async function listJournalEntries(): Promise<JournalEntry[]> {
  await getPayrollPeriod()
  return [...readAccountingState().entries].sort((a, b) =>
    b.date.localeCompare(a.date) || b.voucherNumber.localeCompare(a.voucherNumber),
  )
}

export async function saveManualJournal(input: {
  date: string
  description: string
  debitAccountCode: string
  creditAccountCode: string
  amount: number
}): Promise<JournalEntry> {
  const state = readAccountingState()
  const sequence = state.entries.filter((entry) => entry.type === 'Manual').length + 1
  const dateId = input.date.replaceAll('-', '')
  const journal = createManualJournal({
    ...input,
    id: `manual-${dateId}-${sequence}`,
    voucherNumber: `JM-${dateId}-${String(sequence).padStart(3, '0')}`,
  })

  writeAccountingState({ ...state, entries: [...state.entries, journal] })
  return journal
}

export async function getAccountLedger(accountCode: string, period: string): Promise<LedgerReport> {
  const account = mockAccounts.find((item) => item.code === accountCode)
  if (!account) throw new Error('Akun yang dipilih tidak ditemukan.')
  validatePeriod(period)

  const entries = [...await listJournalEntries()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.voucherNumber.localeCompare(b.voucherNumber),
  )
  const signedMovement = (debit: number, credit: number) =>
    account.normalBalance === 'Debit' ? debit - credit : credit - debit
  const beforePeriod = entries
    .filter((entry) => entry.date.slice(0, 7) < period)
    .flatMap((entry) => entry.lines.filter((line) => line.accountCode === accountCode))
  const openingBalance = beforePeriod.reduce(
    (balance, line) => balance + signedMovement(line.debit, line.credit),
    0,
  )

  let runningBalance = openingBalance
  const movements = entries
    .filter((entry) => entry.date.slice(0, 7) === period)
    .flatMap((entry) => entry.lines
      .filter((line) => line.accountCode === accountCode)
      .map((line) => {
        runningBalance += signedMovement(line.debit, line.credit)
        return {
          entry,
          debit: line.debit,
          credit: line.credit,
          runningBalance: Math.round(runningBalance * 100) / 100,
        }
      }),
    )

  return {
    openingBalance: Math.round(openingBalance * 100) / 100,
    movements,
    closingBalance: Math.round(runningBalance * 100) / 100,
  }
}

export async function getTrialBalance(period: string): Promise<TrialBalanceReport> {
  validatePeriod(period)
  const entries = await listJournalEntries()
  const periodEntries = entries.filter((entry) => entry.date.slice(0, 7) === period)
  const totals = new Map<string, { debit: number; credit: number }>()

  for (const entry of periodEntries) {
    for (const line of entry.lines) {
      const current = totals.get(line.accountCode) ?? { debit: 0, credit: 0 }
      current.debit += line.debit
      current.credit += line.credit
      totals.set(line.accountCode, current)
    }
  }

  const rows = mockAccounts.map((account) => ({
    account,
    debit: Math.round((totals.get(account.code)?.debit ?? 0) * 100) / 100,
    credit: Math.round((totals.get(account.code)?.credit ?? 0) * 100) / 100,
  }))
  const totalDebit = Math.round(rows.reduce((sum, row) => sum + row.debit, 0) * 100) / 100
  const totalCredit = Math.round(rows.reduce((sum, row) => sum + row.credit, 0) * 100) / 100

  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) <= 0.01,
    hasTransactions: periodEntries.length > 0,
  }
}
