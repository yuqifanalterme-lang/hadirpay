import { apiRequest, ApiError, type ApiMeta } from '@/lib/api/client'
import { config } from '@/lib/config'
import type { AccountingAccount, JournalEntry } from '@/lib/mock/accounting'
import type { Akun, BukuBesar, Jurnal, JurnalBatalkanRequest, JurnalCreateRequest, JurnalListQuery, NeracaSaldo } from '@/lib/types/akuntansi'
import {
  createAccount as createAccountMock,
  deleteAccount as deleteAccountMock,
  getAccountLedger as getAccountLedgerMock,
  getTrialBalance as getTrialBalanceMock,
  listAccounts as listAccountsMock,
  listJournalEntries as listJournalEntriesMock,
  saveManualJournal as saveManualJournalMock,
  updateAccount as updateAccountMock,
} from './accounting-service'

export type AccountingPage<T> = { items: T[]; meta: ApiMeta }

export type LedgerMovement = {
  entry: JournalEntry
  debit: number
  credit: number
  runningBalance: number
}
export type LedgerReport = { openingBalance: number; movements: LedgerMovement[]; closingBalance: number }
export type TrialBalanceRow = { account: AccountingAccount; debit: number; credit: number }
export type TrialBalanceReport = {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
  hasTransactions: boolean
}

function parseId(value: string) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(0, 'INVALID_RESOURCE_ID', 'ID data harus berupa bilangan bulat positif dari API.')
  }
  return id
}

function accountCategory(category: Akun['kategori']): AccountingAccount['category'] {
  const values = {
    aset: 'Aset',
    kewajiban: 'Liabilitas',
    ekuitas: 'Ekuitas',
    pendapatan: 'Pendapatan',
    beban: 'Beban',
  } as const
  return values[category]
}

function toAccount(account: Akun): AccountingAccount {
  return {
    id: String(account.id),
    code: account.kode,
    name: account.nama,
    category: accountCategory(account.kategori),
    normalBalance: account.saldo_normal === 'debit' ? 'Debit' : 'Kredit',
    active: account.aktif,
    isMock: false,
  }
}

function toJournal(entry: Jurnal): JournalEntry {
  return {
    id: String(entry.id),
    date: entry.tanggal,
    voucherNumber: entry.nomor_bukti,
    description: entry.keterangan,
    type: entry.sumber === 'otomatis' ? 'Otomatis' : 'Manual',
    status: entry.status,
    dibatalkan_oleh: entry.dibatalkan_oleh,
    dibatalkan_pada: entry.dibatalkan_pada,
    alasan_pembatalan: entry.alasan_pembatalan,
    sourcePeriodId: entry.periode_gaji ? String(entry.periode_gaji.id) : null,
    sourcePeriodLabel: entry.periode_gaji?.periode ?? null,
    totalDebit: entry.total_debit,
    totalCredit: entry.total_kredit,
    lines: entry.detail.map((line) => ({
      accountCode: line.kode_akun,
      accountName: line.nama_akun,
      debit: line.debit,
      credit: line.kredit,
    })),
    isMock: false,
  }
}

function withMockJournalTotals(entry: JournalEntry): JournalEntry {
  return {
    ...entry,
    totalDebit: entry.lines.reduce((total, line) => total + line.debit, 0),
    totalCredit: entry.lines.reduce((total, line) => total + line.credit, 0),
  }
}

function periodBounds(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error('Periode harus menggunakan format YYYY-MM dengan bulan yang valid.')
  }
  const [year, month] = period.split('-').map(Number)
  const end = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { tanggal_dari: `${period}-01`, tanggal_sampai: `${period}-${String(end).padStart(2, '0')}` }
}

function requireMeta(meta: ApiMeta | undefined): ApiMeta {
  if (!meta) {
    throw new ApiError(200, 'INVALID_RESPONSE', 'Respons daftar tidak menyertakan metadata pagination.')
  }
  return meta
}

function pageResult<T>(items: T[], page = 1, perPage = 10): AccountingPage<T> {
  const start = (page - 1) * perPage
  return {
    items: items.slice(start, start + perPage),
    meta: {
      page,
      per_page: perPage,
      total: items.length,
      total_pages: Math.max(1, Math.ceil(items.length / perPage)),
    },
  }
}

export async function listAccounts(): Promise<AccountingAccount[]> {
  if (config.mock.akuntansi) return listAccountsMock()
  const result = await apiRequest<Akun[]>('akun')
  return result.data.map(toAccount)
}

export async function listPayrollCashAccounts(): Promise<Akun[]> {
  const result = await apiRequest<Akun[]>('akun')
  return result.data.filter((account) => account.aktif && account.kategori === 'aset')
}

export async function listJournalEntries(): Promise<JournalEntry[]> {
  if (config.mock.akuntansi) return (await listJournalEntriesMock()).map(withMockJournalTotals)
  const result = await apiRequest<Jurnal[]>('jurnal', { params: { status: 'aktif' } })
  return result.data.map(toJournal)
}

export async function listJournalEntriesPage(query: JurnalListQuery = {}): Promise<AccountingPage<JournalEntry>> {
  if (config.mock.akuntansi) {
    const entries = (await listJournalEntriesMock()).map(withMockJournalTotals)
    const search = query.search?.trim().toLocaleLowerCase('id-ID')
    const filtered = entries.filter((entry) =>
      (!query.tanggal_dari || entry.date >= query.tanggal_dari) &&
      (!query.tanggal_sampai || entry.date <= query.tanggal_sampai) &&
      (!query.sumber || entry.type.toLocaleLowerCase('id-ID') === query.sumber) &&
      (!query.periode_gaji_id || entry.sourcePeriodId === String(query.periode_gaji_id)) &&
      (!search || [entry.voucherNumber, entry.description, ...entry.lines.flatMap((line) => [line.accountCode, line.accountName])]
        .some((value) => value.toLocaleLowerCase('id-ID').includes(search))),
    )
    return pageResult(filtered, query.page, query.per_page)
  }
  const result = await apiRequest<Jurnal[]>('jurnal', { params: { ...query, status: query.status ?? 'aktif' } })
  return { items: result.data.map(toJournal), meta: requireMeta(result.meta) }
}

export async function cancelManualJournal(id: string | number, body: JurnalBatalkanRequest): Promise<Jurnal> {
  const result = await apiRequest<Jurnal>(`jurnal/${parseId(String(id))}`, { method: 'DELETE', body })
  return result.data
}

export async function saveManualJournal(input: {
  date: string
  description: string
  debitAccountCode: string
  creditAccountCode: string
  amount: number
}): Promise<JournalEntry> {
  if (config.mock.akuntansi) return saveManualJournalMock(input)
  const accounts = await apiRequest<Akun[]>('akun')
  const debit = accounts.data.find((item) => item.kode === input.debitAccountCode)
  const credit = accounts.data.find((item) => item.kode === input.creditAccountCode)
  if (!debit || !credit) throw new ApiError(0, 'ACCOUNT_NOT_FOUND', 'Akun debit atau kredit tidak ditemukan.')
  const body: JurnalCreateRequest = {
    tanggal: input.date,
    keterangan: input.description,
    detail: [
      { akun_id: debit.id, debit: input.amount, kredit: 0 },
      { akun_id: credit.id, debit: 0, kredit: input.amount },
    ],
  }
  const result = await apiRequest<Jurnal>('jurnal', { method: 'POST', body })
  return toJournal(result.data)
}

export async function getAccountLedger(accountCode: string, period: string): Promise<LedgerReport> {
  if (config.mock.akuntansi) return getAccountLedgerMock(accountCode, period)
  const [accountsResult, bounds] = await Promise.all([apiRequest<Akun[]>('akun'), Promise.resolve(periodBounds(period))])
  const account = accountsResult.data.find((item) => item.kode === accountCode)
  if (!account) throw new ApiError(0, 'ACCOUNT_NOT_FOUND', 'Akun yang dipilih tidak ditemukan.')
  const result = await apiRequest<BukuBesar>('buku-besar', {
    params: { akun_id: account.id, ...bounds },
  })
  const movements = await Promise.all(result.data.mutasi.map(async (movement) => {
    const journal = await apiRequest<Jurnal>(`jurnal/${movement.jurnal_id}`)
    return {
      entry: toJournal(journal.data),
      debit: movement.debit,
      credit: movement.kredit,
      runningBalance: movement.saldo,
    }
  }))
  return {
    openingBalance: result.data.saldo_awal,
    movements,
    closingBalance: result.data.saldo_akhir,
  }
}

export async function getTrialBalance(period: string): Promise<TrialBalanceReport> {
  if (config.mock.akuntansi) return getTrialBalanceMock(period)
  const bounds = periodBounds(period)
  const endDate = bounds.tanggal_sampai
  const [balanceResult, accountsResult, journalResult] = await Promise.all([
    apiRequest<NeracaSaldo>('neraca-saldo', { params: { tanggal_sampai: endDate } }),
    apiRequest<Akun[]>('akun'),
    apiRequest<Jurnal[]>('jurnal', { params: bounds }),
  ])
  const accounts = new Map(accountsResult.data.map((account) => [account.id, toAccount(account)]))
  const rows = balanceResult.data.akun.map((item) => {
    const account = accounts.get(item.akun_id)
    if (!account) throw new ApiError(0, 'ACCOUNT_NOT_FOUND', `Akun ${item.akun_id} dari neraca saldo tidak ditemukan.`)
    return { account, debit: item.debit, credit: item.kredit }
  })
  return {
    rows,
    totalDebit: balanceResult.data.total_debit,
    totalCredit: balanceResult.data.total_kredit,
    balanced: balanceResult.data.seimbang,
    hasTransactions: journalResult.data.length > 0,
  }
}

export async function createAccount(body: Omit<Akun, 'id'>) {
  if (config.mock.akuntansi) {
    return createAccountMock(body)
  }
  const result = await apiRequest<Akun>('akun', { method: 'POST', body })
  return result.data
}

export async function updateAccount(id: string | number, body: Partial<Akun>) {
  if (config.mock.akuntansi) {
    return updateAccountMock(id, body)
  }
  const result = await apiRequest<Akun>(`akun/${parseId(String(id))}`, { method: 'PUT', body })
  return result.data
}

export async function deleteAccount(id: string | number) {
  if (config.mock.akuntansi) {
    return deleteAccountMock(id)
  }
  await apiRequest<null>(`akun/${parseId(String(id))}`, { method: 'DELETE' })
}
