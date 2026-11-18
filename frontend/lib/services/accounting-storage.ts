import {
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
  return payrollStatuses.includes(state.payrollStatus as PayrollPeriodStatus) && Array.isArray(state.entries)
}

export function readAccountingState(): AccountingState {
  if (typeof window === 'undefined') return mockAccountingState

  const storedState = window.localStorage.getItem(ACCOUNTING_STATE_KEY)
  if (storedState) {
    const parsed: unknown = JSON.parse(storedState)
    if (!isAccountingState(parsed)) throw new Error('Data status penggajian dan jurnal demo tidak valid.')
    return parsed
  }

  const legacyStatus = window.localStorage.getItem(LEGACY_PAYROLL_STATUS_KEY)
  const payrollStatus = payrollStatuses.includes(legacyStatus as PayrollPeriodStatus)
    ? legacyStatus as PayrollPeriodStatus
    : mockAccountingState.payrollStatus
  return { ...mockAccountingState, payrollStatus }
}

export function writeAccountingState(state: AccountingState) {
  if (typeof window === 'undefined') {
    throw new Error('Penyimpanan akuntansi demo hanya tersedia di browser.')
  }
  window.localStorage.setItem(ACCOUNTING_STATE_KEY, JSON.stringify(state))
}
