import {
  mockAccounts,
  mockAccountingState,
  type AccountingState,
} from '@/lib/mock/accounting'
import type { PayrollPeriodStatus } from '@/lib/mock/payroll'

const ACCOUNTING_STATE_KEY = 'hadirpay-accounting-state'
const LEGACY_PAYROLL_STATUS_KEY = 'hadirpay-payroll-status'
const payrollStatuses: PayrollPeriodStatus[] = [
  'Draft',
  'Menunggu validasi keuangan',
  'Disetujui',
  'Dibayar',
]

function isAccountingState(value: unknown): value is AccountingState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<AccountingState>
  return payrollStatuses.includes(state.payrollStatus as PayrollPeriodStatus) &&
    Array.isArray(state.entries) &&
    state.entries.every((entry) => {
      if (!entry || typeof entry !== 'object') return false
      const journal = entry as AccountingState['entries'][number]
      return typeof journal.id === 'string' &&
        typeof journal.date === 'string' &&
        typeof journal.voucherNumber === 'string' &&
        typeof journal.description === 'string' &&
        (journal.type === 'Otomatis' || journal.type === 'Manual') &&
        Array.isArray(journal.lines) &&
        journal.lines.every((line) =>
          typeof line.accountCode === 'string' &&
          typeof line.accountName === 'string' &&
          Number.isFinite(line.debit) &&
          Number.isFinite(line.credit),
        )
    }) &&
    (state.accounts === undefined || (
      Array.isArray(state.accounts) &&
      state.accounts.every((account) =>
        account &&
        typeof account.code === 'string' &&
        typeof account.name === 'string' &&
        typeof account.category === 'string' &&
        typeof account.normalBalance === 'string' &&
        typeof account.isMock === 'boolean',
      )
    ))
}

export function readAccountingState(): AccountingState {
  if (typeof window === 'undefined') return mockAccountingState

  const storedState = window.localStorage.getItem(ACCOUNTING_STATE_KEY)
  if (storedState) {
    const parsed: unknown = JSON.parse(storedState)
    if (!isAccountingState(parsed)) throw new Error('Data status penggajian dan jurnal tidak valid.')
    return { ...parsed, accounts: parsed.accounts ?? mockAccounts }
  }

  const legacyStatus = window.localStorage.getItem(LEGACY_PAYROLL_STATUS_KEY)
  const payrollStatus = payrollStatuses.includes(legacyStatus as PayrollPeriodStatus)
    ? legacyStatus as PayrollPeriodStatus
    : mockAccountingState.payrollStatus
  return { ...mockAccountingState, payrollStatus, accounts: mockAccounts }
}

export function writeAccountingState(state: AccountingState) {
  if (typeof window === 'undefined') {
    throw new Error('Penyimpanan akuntansi tidak tersedia saat ini.')
  }
  window.localStorage.setItem(ACCOUNTING_STATE_KEY, JSON.stringify(state))
}
