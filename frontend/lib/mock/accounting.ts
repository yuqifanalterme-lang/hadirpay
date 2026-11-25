import type { PayrollPeriodStatus } from './payroll'

export type AccountCategory = 'Aset' | 'Liabilitas' | 'Ekuitas' | 'Pendapatan' | 'Beban'
export type NormalBalance = 'Debit' | 'Kredit'
export type JournalType = 'Otomatis' | 'Manual'

export type AccountingAccount = {
  code: string
  name: string
  category: AccountCategory
  normalBalance: NormalBalance
  id?: string
  active?: boolean
  isMock: boolean
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
  status?: 'aktif' | 'dibatalkan'
  dibatalkan_oleh?: { id: number; nama: string } | null
  dibatalkan_pada?: string | null
  alasan_pembatalan?: string | null
  sourcePeriodId: string | null
  sourcePeriodLabel: string | null
  totalDebit?: number
  totalCredit?: number
  lines: JournalLine[]
  isMock: boolean
}

export type AccountingState = {
  payrollStatus: PayrollPeriodStatus
  entries: JournalEntry[]
  accounts?: AccountingAccount[]
}

export const mockAccounts: AccountingAccount[] = [
  { code: '1-1100', name: 'Kas/Bank', category: 'Aset', normalBalance: 'Debit', isMock: true },
  { code: '2-1100', name: 'Utang Gaji', category: 'Liabilitas', normalBalance: 'Kredit', isMock: true },
  { code: '2-1200', name: 'Utang PPh 21', category: 'Liabilitas', normalBalance: 'Kredit', isMock: true },
  { code: '2-1300', name: 'Utang Iuran BPJS', category: 'Liabilitas', normalBalance: 'Kredit', isMock: true },
  { code: '5-1100', name: 'Beban Gaji', category: 'Beban', normalBalance: 'Debit', isMock: true },
]

export const mockAccountingState: AccountingState = {
  payrollStatus: 'Draft',
  entries: [],
  accounts: mockAccounts,
}
