import { apiRequest, ApiError, type ApiMeta } from '@/lib/api/client'
import { config } from '@/lib/config'
import type { ApprovalRequest, RequestStatus, RequestType } from '@/lib/mock/requests'
import type {
  PengajuanBulkRequest,
  PengajuanBulkResponse,
  PengajuanCreateRequest,
  PengajuanDetail,
  PengajuanItem,
  PengajuanListQuery,
  PengajuanListSummary,
} from '@/lib/types/pengajuan'
import {
  createRequest as createRequestMock,
  decideRequest as decideRequestMock,
  listRequests as listRequestsMock,
  cancelRequest as cancelRequestMock,
} from './request-service'

const typeToApi = {
  Izin: 'izin',
  Sakit: 'sakit',
  Cuti: 'cuti',
  'Koreksi Absensi': 'koreksi_absensi',
  Lembur: 'lembur',
} satisfies Record<RequestType, PengajuanCreateRequest['jenis']>

const statusToApi: Record<RequestStatus, NonNullable<PengajuanListQuery['status']>> = {
  'Menunggu persetujuan': 'menunggu',
  Disetujui: 'disetujui',
  Ditolak: 'ditolak',
}

export type RequestListFilters = {
  type?: RequestType
  status?: RequestStatus
  departmentId?: string
  departmentName?: string
  employeeId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  page: number
  perPage: number
}

export type RequestListPage = {
  items: ApprovalRequest[]
  meta: ApiMeta
  summary: PengajuanListSummary
}

function statusToUi(status: PengajuanItem['status']): RequestStatus {
  if (status === 'menunggu') return 'Menunggu persetujuan'
  return status === 'disetujui' ? 'Disetujui' : 'Ditolak'
}

function typeToUi(type: PengajuanItem['jenis']): RequestType {
  const found = Object.entries(typeToApi).find(([, value]) => value === type)
  if (!found) throw new ApiError(0, 'INVALID_REQUEST_TYPE', `Jenis pengajuan "${type}" tidak dikenal.`)
  return found[0] as RequestType
}

function toApprovalRequest(item: PengajuanItem): ApprovalRequest {
  return {
    id: String(item.id),
    employeeId: String(item.karyawan.id),
    name: item.karyawan.nama,
    initials: item.karyawan.inisial,
    position: '',
    department: item.karyawan.departemen,
    type: typeToUi(item.jenis),
    startDate: item.tanggal_mulai,
    endDate: item.tanggal_selesai,
    days: item.jumlah_hari,
    reason: item.alasan,
    attachmentName: item.lampiran_url ?? undefined,
    submittedAt: item.tanggal_diajukan,
    status: statusToUi(item.status),
    approvedBy: item.diproses_oleh?.label,
    rejectionReason: item.alasan_penolakan ?? undefined,
    isMock: false,
  }
}

function numericId(id: string) {
  const value = Number(id)
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ApiError(0, 'INVALID_RESOURCE_ID', 'ID pengajuan harus berupa bilangan bulat positif dari API.')
  }
  return value
}

function summarizeRequests(requests: ApprovalRequest[]): PengajuanListSummary {
  return {
    menunggu: requests.filter((request) => request.status === 'Menunggu persetujuan').length,
    disetujui: requests.filter((request) => request.status === 'Disetujui').length,
    ditolak: requests.filter((request) => request.status === 'Ditolak').length,
  }
}

async function resolveDepartmentId(filters: RequestListFilters): Promise<number | undefined> {
  if (!filters.departmentId && !filters.departmentName) return undefined
  const parsedId = Number(filters.departmentId)
  if (Number.isSafeInteger(parsedId) && parsedId > 0) return parsedId
  if (!filters.departmentName) {
    throw new ApiError(0, 'INVALID_DEPARTMENT_ID', 'ID departemen tidak valid untuk filter pengajuan.')
  }

  const result = await apiRequest<{ id: number; nama: string }[]>('departemen')
  const department = result.data.find((item) => item.nama === filters.departmentName)
  if (!department) {
    throw new ApiError(0, 'MASTER_DATA_NOT_FOUND', `Departemen "${filters.departmentName}" tidak ditemukan.`)
  }
  return department.id
}

export async function listRequestsPage(filters: RequestListFilters): Promise<RequestListPage> {
  const search = filters.search?.trim().toLocaleLowerCase('id-ID')
  if (config.mock.pengajuan) {
    const matchesNonStatusFilters = (request: ApprovalRequest) => {
      if (filters.employeeId && request.employeeId !== filters.employeeId) return false
      if (filters.type && request.type !== filters.type) return false
      if (filters.departmentName && request.department !== filters.departmentName) return false
      if (search && !`${request.id} ${request.name} ${request.type} ${request.reason}`.toLocaleLowerCase('id-ID').includes(search)) return false
      if (filters.dateFrom && request.endDate < filters.dateFrom) return false
      if (filters.dateTo && request.startDate > filters.dateTo) return false
      return true
    }
    const summaryRequests = (await listRequestsMock()).filter(matchesNonStatusFilters)
    const filtered = filters.status
      ? summaryRequests.filter((request) => request.status === filters.status)
      : summaryRequests
    const page = Math.max(1, filters.page)
    const start = (page - 1) * filters.perPage
    return {
      items: filtered.slice(start, start + filters.perPage),
      meta: {
        page,
        per_page: filters.perPage,
        total: filtered.length,
        total_pages: Math.ceil(filtered.length / filters.perPage),
      },
      summary: summarizeRequests(summaryRequests),
    }
  }

  const query: PengajuanListQuery = {
    jenis: filters.type ? typeToApi[filters.type] : undefined,
    status: filters.status ? statusToApi[filters.status] : undefined,
    departemen_id: await resolveDepartmentId(filters),
    search: search || undefined,
    tanggal_dari: filters.dateFrom || undefined,
    tanggal_sampai: filters.dateTo || undefined,
    page: filters.page,
    per_page: filters.perPage,
  }
  const result = await apiRequest<PengajuanItem[], { ringkasan: PengajuanListSummary }>('pengajuan', { params: query })
  if (!result.meta || !result.ringkasan) {
    throw new ApiError(0, 'INVALID_RESPONSE', 'Respons daftar pengajuan tidak menyertakan meta dan ringkasan.')
  }
  return {
    items: result.data.map(toApprovalRequest),
    meta: result.meta,
    summary: result.ringkasan,
  }
}

export async function listRequests(params: PengajuanListQuery = {}): Promise<ApprovalRequest[]> {
  if (config.mock.pengajuan) return listRequestsMock()
  const result = await apiRequest<PengajuanItem[]>('pengajuan', { params })
  return result.data.map(toApprovalRequest)
}

export async function getRequest(id: string): Promise<ApprovalRequest> {
  if (config.mock.pengajuan) {
    const request = (await listRequestsMock()).find((item) => item.id === id)
    if (!request) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Pengajuan tidak ditemukan.')
    return request
  }
  const result = await apiRequest<PengajuanDetail>(`pengajuan/${numericId(id)}`)
  return toApprovalRequest(result.data)
}

export async function createRequest(
  request: Omit<ApprovalRequest, 'id' | 'submittedAt' | 'status' | 'approvedBy' | 'rejectionReason' | 'isMock'> & {
    attachment?: File
    correctedCheckInTime?: string
    correctedCheckOutTime?: string
    overtimeStartTime?: string
    overtimeEndTime?: string
  },
  submittedAt = new Date(),
): Promise<ApprovalRequest> {
  const { attachment, ...mockRequest } = request
  if (config.mock.pengajuan) return createRequestMock(mockRequest, submittedAt)
  if (request.type === 'Koreksi Absensi' && !request.correctedCheckInTime && !request.correctedCheckOutTime) {
    throw new ApiError(
      0,
      'REQUEST_FORM_INCOMPLETE',
      'Isi waktu masuk atau pulang yang benar untuk pengajuan koreksi absensi.',
    )
  }
  let body: PengajuanCreateRequest
  if (request.type === 'Izin' || request.type === 'Sakit' || request.type === 'Cuti') {
    body = {
      jenis: typeToApi[request.type],
      tanggal_mulai: request.startDate,
      tanggal_selesai: request.endDate,
      alasan: request.reason,
      ...(attachment ? { lampiran: attachment } : {}),
    }
  } else if (request.type === 'Koreksi Absensi') {
    if (attachment) {
      throw new ApiError(0, 'REQUEST_FORM_INCOMPLETE', 'Lampiran hanya dapat dikirim untuk izin, sakit, atau cuti.')
    }
    body = {
      jenis: typeToApi[request.type],
      tanggal_mulai: request.startDate,
      alasan: request.reason,
      ...(request.correctedCheckInTime ? { jam_masuk_benar: request.correctedCheckInTime } : {}),
      ...(request.correctedCheckOutTime ? { jam_pulang_benar: request.correctedCheckOutTime } : {}),
    }
  } else {
    if (attachment) {
      throw new ApiError(0, 'REQUEST_FORM_INCOMPLETE', 'Lampiran hanya dapat dikirim untuk izin, sakit, atau cuti.')
    }
    const overtimeStartTime = request.overtimeStartTime
    const overtimeEndTime = request.overtimeEndTime
    if (!overtimeStartTime || !overtimeEndTime) {
      throw new ApiError(0, 'REQUEST_FORM_INCOMPLETE', 'Isi jam mulai dan selesai lembur.')
    }
    body = {
      jenis: typeToApi[request.type],
      tanggal_mulai: request.startDate,
      alasan: request.reason,
      jam_mulai: overtimeStartTime,
      jam_selesai: overtimeEndTime,
    }
  }
  if (request.attachmentName && !attachment) {
    throw new ApiError(
      0,
      'REQUEST_ATTACHMENT_UNAVAILABLE',
      'Berkas lampiran tidak tersedia untuk dikirim. Pilih ulang lampiran sebelum mengirim.',
    )
  }
  let formData: FormData | undefined
  if (attachment) {
    formData = new FormData()
    formData.append('jenis', body.jenis)
    formData.append('tanggal_mulai', body.tanggal_mulai)
    formData.append('alasan', body.alasan)
    if ('tanggal_selesai' in body) formData.append('tanggal_selesai', body.tanggal_selesai)
    if ('jam_masuk_benar' in body && body.jam_masuk_benar) formData.append('jam_masuk_benar', body.jam_masuk_benar)
    if ('jam_pulang_benar' in body && body.jam_pulang_benar) formData.append('jam_pulang_benar', body.jam_pulang_benar)
    if ('jam_mulai' in body) formData.append('jam_mulai', body.jam_mulai)
    if ('jam_selesai' in body) formData.append('jam_selesai', body.jam_selesai)
    if ('lampiran' in body && body.lampiran) formData.append('lampiran', body.lampiran)
  }
  const result = formData
    ? await apiRequest<PengajuanItem>('pengajuan', { method: 'POST', formData })
    : await apiRequest<PengajuanItem>('pengajuan', { method: 'POST', body })
  return toApprovalRequest(result.data)
}

export async function decideRequest(
  id: string,
  decision: 'Disetujui' | 'Ditolak',
  decidedBy: string,
  rejectionReason = '',
): Promise<ApprovalRequest> {
  if (config.mock.pengajuan) return decideRequestMock(id, decision, decidedBy, rejectionReason)
  const resourceId = numericId(id)
  const result = decision === 'Disetujui'
    ? await apiRequest<PengajuanItem>(`pengajuan/${resourceId}/setujui`, {
        method: 'POST',
        body: {},
      })
    : await apiRequest<PengajuanItem>(`pengajuan/${resourceId}/tolak`, {
        method: 'POST',
        body: { alasan_penolakan: rejectionReason },
      })
  return toApprovalRequest(result.data)
}

export async function bulkProcessRequests(request: PengajuanBulkRequest): Promise<PengajuanBulkResponse> {
  if (config.mock.pengajuan) {
    throw new ApiError(0, 'MOCK_BULK_PROCESS_UNAVAILABLE', 'Proses pengajuan sekaligus belum tersedia.')
  }
  const result = await apiRequest<PengajuanBulkResponse>('pengajuan/bulk-proses', {
    method: 'POST',
    body: request,
  })
  return result.data
}

export async function getLeaveQuota() {
  if (config.mock.pengajuan) {
    const { mockLeaveQuota } = await import('@/lib/mock/requests')
    return {
      tahun: 2026,
      cuti_tahunan_total: mockLeaveQuota.annual,
      cuti_terpakai: mockLeaveQuota.used,
      cuti_sisa: mockLeaveQuota.annual - mockLeaveQuota.used,
    }
  }
  const result = await apiRequest<{
    tahun: number
    cuti_tahunan_total: number
    cuti_terpakai: number
    cuti_sisa: number
  }>('pengajuan/kuota')
  return result.data
}

export async function cancelRequest(id: string): Promise<void> {
  if (config.mock.pengajuan) {
    await cancelRequestMock(id)
    return
  }
  await apiRequest<null>(`pengajuan/${numericId(id)}`, { method: 'DELETE' })
}
