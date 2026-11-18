import type { PayrollPeriodStatus } from './payroll'

export type AccountCategory = 'Aset' | 'Liabilitas' | 'Beban'
export type NormalBalance = 'Debit' | 'Kredit'
export type JournalType = 'Otomatis' | 'Manual'

export type AccountingAccount = {
  code: string
  name: string
  category: AccountCategory
  normalBalance: NormalBalance
  isMock: true
}

export type JournalLine = {
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

export type JournalEntry = {
  id: string
  date: string
  voucherNumber: string
  description: string
  type: JournalType
  sourcePeriodId: string | null
  sourcePeriodLabel: string | null
  lines: JournalLine[]
  isMock: true
}

export type AccountingState = {
  payrollStatus: PayrollPeriodStatus
  entries: JournalEntry[]
}

export const mockAccounts: AccountingAccount[] = [
  { code: '1-1100', name: 'Kas/Bank', category: 'Aset', normalBalance: 'Debit', isMock: true },
  { code: '2-1200', name: 'Utang Gaji', category: 'Liabilitas', normalBalance: 'Kredit', isMock: true },
  { code: '2-1300', name: 'Utang PPh 21', category: 'Liabilitas', normalBalance: 'Kredit', isMock: true },
  { code: '2-1400', name: 'Utang Iuran BPJS', category: 'Liabilitas', normalBalance: 'Kredit', isMock: true },
  { code: '6-1100', name: 'Beban Gaji', category: 'Beban', normalBalance: 'Debit', isMock: true },
]

export const mockAccountingState: AccountingState = {
  payrollStatus: 'Draft',
  entries: [],
}
