import { apiBlob, apiRequest, ApiError, type ApiMeta } from '@/lib/api/client'
import { config } from '@/lib/config'
import { listAccounts, listPayrollCashAccounts } from '@/lib/services/akuntansi.service'
import type { PayrollComponent, PayrollLine, PayrollPeriod, PayrollPeriodStatus } from '@/lib/mock/payroll'
import type { Role as UiRole } from '@/lib/navigation'
import type {
  KomponenGaji,
  KomponenGajiStatusRequest,
  KomponenGajiWriteRequest,
  PeriodeBayarRequest,
  PeriodeGaji,
  PeriodeGajiCreateRequest,
  PeriodeGajiDetail,
  PeriodeHitungResponse,
  PeriodeKembalikanRequest,
  PeriodeRekapAbsensi,
  PeriodeListQuery,
  PeriodePembatalanRequest,
  PeriodePayrollListQuery,
  PenggajianDetail,
  PenggajianListItem,
  SlipGajiDetail,
  SlipGajiItem,
  SlipListQuery,
} from '@/lib/types/penggajian'
import {
  deletePayrollComponent as deletePayrollComponentMock,
  getPayrollPeriod as getPayrollPeriodMock,
  listPayrollComponents as listPayrollComponentsMock,
  listPayrollLines as listPayrollLinesMock,
  savePayrollComponent as savePayrollComponentMock,
  updatePayrollStatus as updatePayrollStatusMock,
  returnPayrollPeriod as returnPayrollPeriodMock,
} from './payroll-service'
import type { Employee } from '@/lib/mock/employees'

export type PayrollCashAccountOption = {
  id: string
  code: string
  name: string
}

export type PayrollPage<T> = { items: T[]; meta: ApiMeta }

function parseId(value: string) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(0, 'INVALID_RESOURCE_ID', 'ID data harus berupa bilangan bulat positif dari API.')
  }
  return id
}

function requireLivePayroll(): void {
  if (config.mock.penggajian) {
    throw new ApiError(0, 'MOCK_PAYROLL_WORKFLOW_UNAVAILABLE', 'Alur penggajian ini belum tersedia.')
  }
}

function uiPeriodStatus(status: PeriodeGaji['status']): PayrollPeriodStatus {
  if (status === 'draft') return 'Draft'
  if (status === 'menunggu_validasi') return 'Menunggu validasi keuangan'
  if (status === 'dibatalkan') return 'Dibatalkan'
  return status === 'disetujui' ? 'Disetujui' : 'Dibayar'
}

function formatApiDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

function toUiPeriod(period: PeriodeGaji): PayrollPeriod {
  return {
    id: String(period.id),
    period: period.label ?? period.periode,
    cutoffDate: formatApiDate(period.tanggal_tutup),
    workDays: period.hari_kerja,
    employeeCount: period.jumlah_karyawan,
    totalNetPay: period.total_gaji_bersih,
    status: uiPeriodStatus(period.status),
    closed: period.ditutup ?? false,
    isMock: false,
  }
}

function methodToUi(method: KomponenGaji['metode']): PayrollComponent['method'] {
  const values = {
    nominal_tetap: 'nominal tetap',
    persen: 'persen',
    per_hari: 'per hari',
    per_jam: 'per jam',
    per_menit: 'per menit',
  } as const
  return values[method]
}

function toUiComponent(item: KomponenGaji): PayrollComponent {
  return {
    id: String(item.id),
    code: item.kode,
    name: item.nama,
    category: item.tipe,
    method: methodToUi(item.metode),
    amount: item.nilai,
    description: item.keterangan,
    active: item.aktif,
    isMock: false,
  }
}

function methodToApi(method: PayrollComponent['method']): KomponenGaji['metode'] {
  const values: Record<PayrollComponent['method'], KomponenGaji['metode']> = {
    'nominal tetap': 'nominal_tetap',
    persen: 'persen',
    'per hari': 'per_hari',
    'per jam': 'per_jam',
    'per menit': 'per_menit',
  }
  return values[method]
}

function requestComponent(component: Omit<PayrollComponent, 'isMock'> & { isMock?: true }): KomponenGajiWriteRequest {
  if (!component.code?.trim()) {
    throw new ApiError(422, 'COMPONENT_CODE_REQUIRED', 'Kode komponen wajib diisi.')
  }
  return {
    kode: component.code.trim(),
    nama: component.name,
    tipe: component.category,
    metode: methodToApi(component.method),
    nilai: component.amount,
    ...(component.description !== undefined ? { keterangan: component.description } : {}),
    aktif: component.active,
  }
}

export async function listPayrollComponents(): Promise<PayrollComponent[]> {
  if (config.mock.penggajian) return listPayrollComponentsMock()
  const result = await apiRequest<KomponenGaji[]>('komponen-gaji')
  return result.data.map(toUiComponent)
}

export async function savePayrollComponent(
  component: Omit<PayrollComponent, 'isMock'> & { isMock?: true },
): Promise<PayrollComponent[]> {
  if (config.mock.penggajian) return savePayrollComponentMock(component)
  const id = Number(component.id)
  if (Number.isSafeInteger(id) && id > 0) {
    const current = (await listPayrollComponents()).find((item) => item.id === String(id))
    if (!current) throw new ApiError(404, 'COMPONENT_NOT_FOUND', 'Komponen gaji tidak ditemukan.')
    const code = component.code
    if (!code?.trim()) throw new ApiError(422, 'COMPONENT_CODE_REQUIRED', 'Kode komponen wajib diisi.')
    const body: Partial<KomponenGajiWriteRequest> = {}
    if (code.trim() !== current.code) body.kode = code.trim()
    if (component.name !== current.name) body.nama = component.name
    if (component.category !== current.category) body.tipe = component.category
    if (component.method !== current.method) body.metode = methodToApi(component.method)
    if (component.amount !== current.amount) body.nilai = component.amount
    if (component.active !== current.active) body.aktif = component.active
    if (Object.keys(body).length > 0) {
      await apiRequest<KomponenGaji>(`komponen-gaji/${id}`, { method: 'PUT', body })
    }
  } else {
    const body = requestComponent(component)
    await apiRequest<KomponenGaji>('komponen-gaji', { method: 'POST', body })
  }
  return listPayrollComponents()
}

export async function deletePayrollComponent(id: string): Promise<PayrollComponent[]> {
  if (config.mock.penggajian) return deletePayrollComponentMock(id)
  await apiRequest<null>(`komponen-gaji/${parseId(id)}`, { method: 'DELETE' })
  return listPayrollComponents()
}

export async function updatePayrollComponentStatus(id: string, aktif: boolean): Promise<PayrollComponent[]> {
  if (config.mock.penggajian) {
    const current = (await listPayrollComponentsMock()).find((component) => component.id === id)
    if (!current) throw new ApiError(404, 'COMPONENT_NOT_FOUND', 'Komponen gaji tidak ditemukan.')
    return savePayrollComponentMock({ ...current, active: aktif, isMock: true })
  }
  const parsedId = parseId(id)
  const body: KomponenGajiStatusRequest = { aktif }
  await apiRequest<KomponenGaji>(`komponen-gaji/${parsedId}/status`, { method: 'PATCH', body })
  return listPayrollComponents()
}

export async function listPayrollPeriods(query: PeriodeListQuery = {}): Promise<PeriodeGaji[]> {
  if (config.mock.penggajian) {
    const mock = await getPayrollPeriodMock()
    return [{
      id: 1,
      periode: '2026-11',
      label: mock.period,
      tanggal_tutup: '2026-11-25',
      hari_kerja: mock.workDays,
      status: mock.status === 'Draft' ? 'draft' : mock.status === 'Menunggu validasi keuangan' ? 'menunggu_validasi' : mock.status.toLowerCase() as PeriodeGaji['status'],
      jumlah_karyawan: mock.employeeCount,
      total_gaji_bersih: mock.totalNetPay,
    }]
  }
  const result = await apiRequest<PeriodeGaji[]>('periode-gaji', { params: query })
  return result.data
}

export async function listPayrollCashAccountOptions(): Promise<PayrollCashAccountOption[]> {
  if (config.mock.penggajian) {
    const accounts = await listAccounts()
    return accounts
      .filter((account) => account.category === 'Aset' && account.active !== false)
      .map((account) => ({
        id: account.id ?? account.code,
        code: account.code,
        name: account.name,
      }))
  }
  const accounts = await listPayrollCashAccounts()
  return accounts.map((account) => ({
    id: String(account.id ?? account.kode),
    code: account.kode,
    name: account.nama,
  }))
}

export async function createPayrollPeriod(body: PeriodeGajiCreateRequest): Promise<PeriodeGaji> {
  requireLivePayroll()
  const result = await apiRequest<PeriodeGaji>('periode-gaji', { method: 'POST', body })
  return result.data
}

export async function getPayrollPeriodDetail(id: string | number): Promise<PeriodeGajiDetail> {
  requireLivePayroll()
  const result = await apiRequest<PeriodeGajiDetail>(`periode-gaji/${parseId(String(id))}`)
  return result.data
}

export async function getPayrollAttendanceReview(id: string | number): Promise<PeriodeRekapAbsensi> {
  requireLivePayroll()
  const result = await apiRequest<PeriodeRekapAbsensi>(`periode-gaji/${parseId(String(id))}/rekap-absensi`)
  return result.data
}

export async function calculatePayrollPeriod(id: string | number): Promise<PeriodeHitungResponse> {
  requireLivePayroll()
  const result = await apiRequest<PeriodeHitungResponse>(`periode-gaji/${parseId(String(id))}/hitung`, {
    method: 'POST',
    body: {},
  })
  return result.data
}

async function findSinglePeriod(id?: string | number): Promise<PeriodeGaji> {
  const periods = await listPayrollPeriods()
  if (id !== undefined) {
    const selected = periods.find((period) => String(period.id) === String(id))
    if (!selected) throw new ApiError(404, 'PERIOD_NOT_FOUND', 'Periode penggajian tidak ditemukan.')
    return selected
  }
  if (periods.length !== 1) {
    throw new ApiError(
      0,
      'PERIOD_SELECTION_REQUIRED',
      'Kontrak mengembalikan daftar periode, sedangkan tampilan ini belum menyediakan pemilih periode.',
    )
  }
  return periods[0]
}

export async function getPayrollPeriod(): Promise<PayrollPeriod> {
  if (config.mock.penggajian) return getPayrollPeriodMock()
  return toUiPeriod(await findSinglePeriod())
}

export async function getPayrollPeriodById(id: string | number): Promise<PayrollPeriod> {
  if (config.mock.penggajian) return getPayrollPeriodMock()
  return toUiPeriod(await findSinglePeriod(parseId(String(id))))
}

export async function updatePayrollStatus(
  role: UiRole,
  action: 'submit' | 'approve' | 'pay',
  payment?: PeriodeBayarRequest,
  periodId?: string | number,
): Promise<PayrollPeriod> {
  if (config.mock.penggajian) return updatePayrollStatusMock(role, action)
  const period = await findSinglePeriod(periodId)
  if ((action === 'submit' && role !== 'admin') || (action !== 'submit' && role !== 'keuangan')) {
    throw new ApiError(403, 'FORBIDDEN', 'Tidak punya akses')
  }
  const path = action === 'submit'
    ? `periode-gaji/${period.id}/ajukan-validasi`
    : action === 'approve'
      ? `periode-gaji/${period.id}/setujui`
      : `periode-gaji/${period.id}/bayar`
  if (action === 'pay' && !payment) {
    throw new ApiError(
      0,
      'PAYMENT_DETAILS_REQUIRED',
      'Kontrak mensyaratkan tanggal_bayar dan akun_kas_id, tetapi tampilan ini belum mengumpulkan datanya.',
    )
  }
  const result = await apiRequest<PeriodeGajiDetail>(path, {
    method: 'POST',
    body: action === 'pay' ? payment : {},
  })
  const updated = await listPayrollPeriods()
  const latest = updated.find((item) => item.id === result.data.id)
  if (!latest) {
    throw new ApiError(0, 'PERIOD_NOT_FOUND', 'Periode terbaru tidak ditemukan setelah perubahan status.')
  }
  return toUiPeriod({
    ...latest,
    status: result.data.status,
  })
}

export async function returnPayrollPeriod(id: string | number, body: PeriodeKembalikanRequest): Promise<void> {
  if (!body.catatan.trim()) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Catatan pengembalian wajib diisi.')
  }
  if (config.mock.penggajian) {
    await returnPayrollPeriodMock()
    return
  }
  await apiRequest<PeriodeGajiDetail>(`periode-gaji/${parseId(String(id))}/kembalikan`, {
    method: 'POST',
    body,
  })
}

export async function cancelPayrollPayment(id: string | number, body: PeriodePembatalanRequest): Promise<PeriodeGajiDetail> {
  const result = await apiRequest<PeriodeGajiDetail>(
    `periode-gaji/${parseId(String(id))}/batalkan-pembayaran`,
    { method: 'POST', body },
  )
  return result.data
}

export async function cancelPayrollApproval(id: string | number, body: PeriodePembatalanRequest): Promise<PeriodeGajiDetail> {
  const result = await apiRequest<PeriodeGajiDetail>(
    `periode-gaji/${parseId(String(id))}/batalkan-persetujuan`,
    { method: 'POST', body },
  )
  return result.data
}

export async function cancelPayroll(id: string | number, body: PeriodePembatalanRequest): Promise<PeriodeGajiDetail> {
  const result = await apiRequest<PeriodeGajiDetail>(
    `periode-gaji/${parseId(String(id))}/batalkan`,
    { method: 'POST', body },
  )
  return result.data
}

export async function deleteDraftPayroll(id: string | number): Promise<void> {
  await apiRequest<null>(`periode-gaji/${parseId(String(id))}`, { method: 'DELETE' })
}

function pageResult<T>(items: T[], page = 1, perPage = 10): PayrollPage<T> {
  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    meta: {
      page,
      per_page: perPage,
      total: items.length,
      total_pages: Math.max(1, Math.ceil(items.length / perPage)),
    },
  }
}

function requireMeta(meta: ApiMeta | undefined): ApiMeta {
  if (!meta) {
    throw new ApiError(200, 'INVALID_RESPONSE', 'Respons daftar tidak menyertakan metadata pagination.')
  }
  return meta
}

export async function listPayrollLines(query: PeriodePayrollListQuery = {}, periodId?: string | number): Promise<PayrollPage<PayrollLine>> {
  if (config.mock.penggajian) return pageResult(await listPayrollLinesMock(), query.page, query.per_page)
  const period = await findSinglePeriod(periodId)
  const result = await apiRequest<PenggajianListItem[]>(`periode-gaji/${period.id}/penggajian`, { params: query })
  const items = await Promise.all(result.data.map(async (line) => {
    const detailResult = await apiRequest<PenggajianDetail>(`penggajian/${line.id}`)
    const detail = detailResult.data
    const employeeResult = await apiRequest<{
      jenis_penggajian: Employee['payrollType']
    }>(`karyawan/${detail.karyawan.id}`)
    const earnings = detail.rincian.filter((item) => item.tipe === 'pendapatan')
    const deductions = detail.rincian.filter((item) => item.tipe === 'potongan')
    return {
      employeeId: String(detail.karyawan.id),
      employeeName: detail.karyawan.nama,
      position: detail.karyawan.jabatan,
      department: detail.karyawan.departemen,
      initials: detail.karyawan.nama.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      payrollType: employeeResult.data.jenis_penggajian,
      employeeCount: 1,
      baseSalary: line.gaji_pokok,
      fixedAllowance: line.tunjangan,
      overtimePay: line.upah_lembur,
      totalEarnings: line.total_pendapatan,
      totalDeductions: line.total_potongan,
      netPay: line.gaji_bersih,
      workDays: detail.kehadiran.hari_kerja,
      presentDays: detail.kehadiran.hadir,
      lateCount: detail.kehadiran.terlambat,
      absenceDays: detail.kehadiran.alpha,
      overtimeHours: detail.kehadiran.jam_lembur,
      earnings: earnings.map((item) => ({ label: item.nama, amount: item.jumlah })),
      deductions: deductions.map((item) => ({ label: item.nama, amount: item.jumlah })),
      isAggregate: false,
      isMock: false,
    }
  }))
  return { items, meta: requireMeta(result.meta) }
}

export async function listPayslips(query: SlipListQuery = {}): Promise<PayrollPage<SlipGajiItem>> {
  requireLivePayroll()
  const result = await apiRequest<SlipGajiItem[]>('slip-gaji', { params: query })
  return { items: result.data, meta: requireMeta(result.meta) }
}

export async function getPayslip(id: string | number): Promise<SlipGajiDetail> {
  requireLivePayroll()
  const result = await apiRequest<SlipGajiDetail>(`slip-gaji/${parseId(String(id))}`)
  return result.data
}

export async function downloadPayslipPdf(id: string | number): Promise<Blob> {
  requireLivePayroll()
  return apiBlob(`slip-gaji/${parseId(String(id))}/pdf`)
}
