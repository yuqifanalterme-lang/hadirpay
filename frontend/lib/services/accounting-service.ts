import { mockAccounts } from '@/lib/mock/accounting'
import type { AccountingAccount, JournalEntry } from '@/lib/mock/accounting'
import { createManualJournal } from '@/lib/accounting/journal'
import { readAccountingState, writeAccountingState } from './accounting-storage'
import { getPayrollPeriod } from './payroll-service'
import type { Akun, AkunWriteRequest } from '@/lib/types/akuntansi'

const categoryLabels: Record<Akun['kategori'], AccountingAccount['category']> = {
  aset: 'Aset',
  kewajiban: 'Liabilitas',
  ekuitas: 'Ekuitas',
  pendapatan: 'Pendapatan',
  beban: 'Beban',
}
const categoryValues: Record<AccountingAccount['category'], Akun['kategori']> = {
  Aset: 'aset',
  Liabilitas: 'kewajiban',
  Ekuitas: 'ekuitas',
  Pendapatan: 'pendapatan',
  Beban: 'beban',
}

function accountFromWrite(input: AkunWriteRequest, id = input.kode): AccountingAccount {
  return {
    id,
    code: input.kode,
    name: input.nama,
    category: categoryLabels[input.kategori],
    normalBalance: input.saldo_normal === 'debit' ? 'Debit' : 'Kredit',
    active: input.aktif,
    isMock: true,
  }
}

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
  return readAccountingState().accounts ?? mockAccounts
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
    accounts: state.accounts ?? mockAccounts,
  })

  writeAccountingState({ ...state, entries: [...state.entries, journal] })
  return journal
}

export async function updateManualJournal(id: string | number, input: {
  date: string
  description: string
  debitAccountCode: string
  creditAccountCode: string
  amount: number
}): Promise<JournalEntry> {
  const state = readAccountingState()
  const current = state.entries.find((entry) => entry.id === String(id))
  if (!current) throw new Error('Jurnal yang akan diubah tidak ditemukan.')
  if (current.type !== 'Manual') throw new Error('Jurnal otomatis tidak boleh diubah.')
  if (current.status === 'dibatalkan') throw new Error('Jurnal yang sudah dibatalkan tidak boleh diubah.')

  const updated = createManualJournal({
    ...input,
    id: current.id,
    voucherNumber: current.voucherNumber,
    accounts: state.accounts ?? mockAccounts,
  })
  updated.status = 'aktif'
  writeAccountingState({
    ...state,
    entries: state.entries.map((entry) => entry.id === current.id ? updated : entry),
  })
  return updated
}

export async function cancelManualJournal(id: string | number, reason: string): Promise<void> {
  const state = readAccountingState()
  const current = state.entries.find((entry) => entry.id === String(id))
  if (!current) throw new Error('Jurnal yang akan dibatalkan tidak ditemukan.')
  if (current.type !== 'Manual') throw new Error('Jurnal otomatis tidak boleh dibatalkan dari jurnal umum.')
  if (current.status === 'dibatalkan') throw new Error('Jurnal sudah dibatalkan.')
  if (!reason.trim()) throw new Error('Alasan pembatalan wajib diisi.')

  writeAccountingState({
    ...state,
    entries: state.entries.map((entry) => entry.id === current.id
      ? {
          ...entry,
          status: 'dibatalkan',
          dibatalkan_pada: new Date().toISOString(),
          alasan_pembatalan: reason.trim(),
        }
      : entry),
  })
}

export async function createAccount(input: AkunWriteRequest): Promise<AccountingAccount> {
  const state = readAccountingState()
  const accounts = state.accounts ?? mockAccounts
  if (accounts.some((account) => account.code === input.kode)) {
    throw new Error(`Kode akun ${input.kode} sudah digunakan.`)
  }
  const account = accountFromWrite(input)
  writeAccountingState({ ...state, accounts: [...accounts, account] })
  return account
}

export async function updateAccount(id: string | number, input: Partial<Akun>): Promise<AccountingAccount> {
  const state = readAccountingState()
  const accounts = state.accounts ?? mockAccounts
  const currentIndex = accounts.findIndex((account) => account.id === String(id) || account.code === String(id))
  if (currentIndex < 0) throw new Error('Akun yang akan diubah tidak ditemukan.')

  const current = accounts[currentIndex]
  const updated = accountFromWrite({
    kode: input.kode ?? current.code,
    nama: input.nama ?? current.name,
    kategori: input.kategori ?? categoryValues[current.category],
    saldo_normal: input.saldo_normal ?? (current.normalBalance === 'Debit' ? 'debit' : 'kredit'),
    aktif: input.aktif ?? current.active ?? true,
  }, current.id ?? current.code)
  if (accounts.some((account, index) => index !== currentIndex && account.code === updated.code)) {
    throw new Error(`Kode akun ${updated.code} sudah digunakan.`)
  }
  const nextAccounts = [...accounts]
  nextAccounts[currentIndex] = updated
  writeAccountingState({ ...state, accounts: nextAccounts })
  return updated
}

export async function deleteAccount(id: string | number): Promise<void> {
  const state = readAccountingState()
  const accounts = state.accounts ?? mockAccounts
  const account = accounts.find((item) => item.id === String(id) || item.code === String(id))
  if (!account) throw new Error('Akun yang akan dihapus tidak ditemukan.')
  if (state.entries.some((entry) => entry.lines.some((line) => line.accountCode === account.code))) {
    throw new Error('Akun yang sudah digunakan pada jurnal tidak dapat dihapus.')
  }
  writeAccountingState({
    ...state,
    accounts: accounts.filter((item) => item.code !== account.code),
  })
}

export async function getAccountLedger(accountCode: string, period: string): Promise<LedgerReport> {
  const account = (await listAccounts()).find((item) => item.code === accountCode)
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
  const [entries, accounts] = await Promise.all([listJournalEntries(), listAccounts()])
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

  const rows = accounts.map((account) => ({
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
