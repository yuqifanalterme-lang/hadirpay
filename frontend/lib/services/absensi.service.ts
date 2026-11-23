import { apiBlob, apiRequest, ApiError, type ApiMeta } from '@/lib/api/client'
import { config } from '@/lib/config'
import type {
  AttendanceCorrection,
  EmployeeAttendanceRecord,
  EmployeeAttendanceStatus,
} from '@/lib/mock/attendance'
import type {
  AdminDailyAttendanceRow as MockAdminDailyAttendanceRow,
  MonthlyAttendanceSummaryRow,
} from './admin-attendance-service'
import type {
  AbsensiAdminItem,
  AbsensiAdminQuery,
  AbsensiAdminSummary,
  AbsensiExportQuery,
  AbsensiHariIni,
  AbsensiLokasiRequest,
  AbsensiRekap,
  AbsensiRekapQuery,
  AbsensiRiwayat,
  CheckInResponse,
  CheckOutResponse,
} from '@/lib/types/absensi'
import type { PengajuanDetail, PengajuanItem } from '@/lib/types/pengajuan'
import {
  formatAttendanceTime as formatAttendanceTimeMock,
  getLocalDateKey as getLocalDateKeyMock,
  listAttendanceCorrections as listAttendanceCorrectionsMock,
  listAttendanceRecords as listAttendanceRecordsMock,
  recordCheckIn as recordCheckInMock,
  recordCheckOut as recordCheckOutMock,
  submitAttendanceCorrection as submitAttendanceCorrectionMock,
  decideAttendanceCorrection as decideAttendanceCorrectionMock,
} from './attendance-service'
import {
  getMonthlyAttendanceSummary as getMonthlyAttendanceSummaryMock,
  listAdminDailyAttendance as listAdminDailyAttendanceMock,
} from './admin-attendance-service'

let latestServerTime: Date | null = null
let latestServerDate: string | null = null
let latestServerReceivedAt: number | null = null
let latestAttendanceStatus: EmployeeAttendanceStatus | null = null

const apiStatusToUi: Record<string, EmployeeAttendanceStatus> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  cuti: 'Cuti',
  alpha: 'Alpha',
  dinas_luar: 'Dinas Luar',
}

export type AdminDailyAttendanceRow = Omit<MockAdminDailyAttendanceRow, 'status'> & {
  status: EmployeeAttendanceStatus | null
}
export type { MonthlyAttendanceSummaryRow }

export type AttendanceSummary = {
  workDays: number
  present: number
  late: number
  permission: number
  sick: number
  leave: number
  absent: number
}

export type AttendanceHistoryPage = {
  period: string
  summary: AttendanceSummary
  calendar: { date: string; status: EmployeeAttendanceStatus }[]
  records: EmployeeAttendanceRecord[]
  meta?: { page: number; per_page: number; total: number; total_pages: number }
}

export type AttendanceToday = {
  date: string
  serverTime: string
  workHours: { checkIn: string; checkOut: string; lateToleranceMinutes: number }
  office: { name: string; address: string; latitude: number; longitude: number; radiusMeters: number }
  attendance: EmployeeAttendanceRecord | null
  canCheckIn: boolean
  canCheckOut: boolean
  checkoutAvailableAt: string | null
}

export function getCurrentAttendanceLocation(): Promise<AbsensiLokasiRequest> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Perangkat ini tidak menyediakan layanan lokasi.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          reject(new Error('Koordinat lokasi perangkat tidak valid.'))
          return
        }
        resolve({ latitude, longitude })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini sebelum absen.'))
          return
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error('Lokasi perangkat tidak tersedia. Periksa GPS lalu coba lagi.'))
          return
        }
        reject(new Error('Pemeriksaan lokasi melewati batas waktu. Aktifkan GPS lalu coba lagi.'))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

export function formatAttendanceRadius(radiusMeters: number): string {
  if (radiusMeters >= 1000) {
    const kilometers = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(radiusMeters / 1000)
    return `${kilometers} km`
  }
  return `${radiusMeters} m`
}

export type AdminAttendancePage = {
  items: AdminDailyAttendanceRow[]
  summary: AbsensiAdminSummary
  meta?: { page: number; per_page: number; total: number; total_pages: number }
}

export type MonthlyAttendancePage = {
  period: string
  summary: AbsensiRekap['ringkasan']
  items: MonthlyAttendanceSummaryRow[]
  meta?: ApiMeta
}

function updateServerClock(data: Pick<AbsensiHariIni, 'tanggal' | 'server_time' | 'absensi'>) {
  const parsed = new Date(data.server_time)
  if (!Number.isFinite(parsed.getTime())) {
    throw new ApiError(0, 'INVALID_SERVER_TIME', 'Waktu server absensi tidak valid.')
  }
  latestServerTime = parsed
  latestServerDate = data.tanggal
  latestServerReceivedAt = Date.now()
  latestAttendanceStatus = data.absensi
    ? apiStatusToUi[data.absensi.status] ?? null
    : null
}

function toUiTime(value: string | null): string | null {
  return value ? value.slice(0, 5).replace(':', '.') : null
}

function toApiTime(value: string): string {
  return value.replace('.', ':')
}

function attendanceRecord(
  date: string,
  checkIn: string | null,
  checkOut: string | null,
  status: string,
): EmployeeAttendanceRecord {
  const mappedStatus = apiStatusToUi[status]
  if (!mappedStatus) throw new ApiError(0, 'INVALID_ATTENDANCE_STATUS', `Status absensi "${status}" tidak dikenal.`)
  return {
    date,
    checkIn: toUiTime(checkIn),
    checkOut: toUiTime(checkOut),
    status: mappedStatus,
    isMock: false,
  }
}

function correctionFromRequest(item: PengajuanItem, detail: PengajuanDetail): AttendanceCorrection {
  const data = detail.data_koreksi
  if (!data || (!data.jam_masuk_benar && !data.jam_pulang_benar)) {
    throw new ApiError(0, 'MISSING_CORRECTION_DATA', 'Data koreksi absensi tidak tersedia pada respons API.')
  }
  const approvedBy = item.diproses_oleh?.label
  return {
    id: String(item.id),
    date: data.tanggal,
    field: data.jam_masuk_benar ? 'Masuk' : 'Pulang',
    correctedTime: toUiTime(data.jam_masuk_benar ?? data.jam_pulang_benar) ?? '',
    reason: item.alasan,
    submittedAt: item.tanggal_diajukan,
    submittedOn: item.tanggal_diajukan,
    status: item.status === 'menunggu' ? 'Menunggu' : item.status === 'disetujui' ? 'Disetujui' : 'Ditolak',
    approvedBy,
    rejectionReason: item.alasan_penolakan ?? undefined,
    isMock: false,
  }
}

export function formatAttendanceTime(date: Date) {
  if (config.mock.absensi) return formatAttendanceTimeMock(date)
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date).replace(':', '.')
}

export function getLocalDateKey(date?: Date) {
  if (!config.mock.absensi) {
    const effectiveDate = getServerTime()
    if (!effectiveDate) return latestServerDate ?? ''
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(effectiveDate)
  }
  return getLocalDateKeyMock(date ?? new Date())
}

export function getServerTime(): Date | null {
  if (!latestServerTime) return null
  const elapsed = latestServerReceivedAt === null ? 0 : Date.now() - latestServerReceivedAt
  return new Date(latestServerTime.getTime() + elapsed)
}

export function canCheckInNow(today: AttendanceToday): boolean {
  if (!today.canCheckIn) return false
  const now = getServerTime()
  const cutoff = Date.parse(`${today.date}T${today.workHours.checkOut}:00+07:00`)
  return now !== null && Number.isFinite(cutoff) && now.getTime() < cutoff
}

export function canCheckOutNow(today: AttendanceToday): boolean {
  if (today.canCheckOut) return true
  if (!today.attendance?.checkIn || today.attendance.checkOut || !today.checkoutAvailableAt) return false
  const now = getServerTime()
  const availableAt = Date.parse(today.checkoutAvailableAt)
  return now !== null && Number.isFinite(availableAt) && now.getTime() >= availableAt
}

export function getAttendanceAction(today: AttendanceToday): 'Masuk' | 'Pulang' | null {
  if (canCheckInNow(today)) return 'Masuk'
  if (canCheckOutNow(today)) return 'Pulang'
  return null
}

async function fetchAttendanceToday(): Promise<AbsensiHariIni> {
  const result = await apiRequest<AbsensiHariIni>('absensi/hari-ini')
  updateServerClock(result.data)
  return result.data
}

export async function getAttendanceToday(): Promise<AttendanceToday | null> {
  if (config.mock.absensi) return null
  const data = await fetchAttendanceToday()
  return {
    date: data.tanggal,
    serverTime: data.server_time,
    workHours: {
      checkIn: data.jam_kerja.masuk,
      checkOut: data.jam_kerja.pulang,
      lateToleranceMinutes: data.jam_kerja.toleransi_menit,
    },
    office: {
      name: data.lokasi_kantor.nama,
      address: data.lokasi_kantor.alamat,
      latitude: data.lokasi_kantor.latitude,
      longitude: data.lokasi_kantor.longitude,
      radiusMeters: data.lokasi_kantor.radius_meter,
    },
    attendance: data.absensi
      ? attendanceRecord(data.tanggal, data.absensi.jam_masuk, data.absensi.jam_pulang, data.absensi.status)
      : null,
    canCheckIn: data.bisa_absen_masuk,
    canCheckOut: data.bisa_absen_pulang,
    checkoutAvailableAt: data.pulang_paling_cepat,
  }
}

function summaryFromRecords(records: EmployeeAttendanceRecord[]): AttendanceSummary {
  return {
    workDays: records.length,
    present: records.filter((record) => record.status === 'Hadir').length,
    late: records.filter((record) => record.status === 'Terlambat').length,
    permission: records.filter((record) => record.status === 'Izin').length,
    sick: records.filter((record) => record.status === 'Sakit').length,
    leave: records.filter((record) => record.status === 'Cuti').length,
    absent: records.filter((record) => record.status === 'Alpha').length,
  }
}

export async function getAttendanceHistory(
  period: string,
  page = 1,
  perPage = 20,
): Promise<AttendanceHistoryPage> {
  if (config.mock.absensi) {
    const records = (await listAttendanceRecordsMock())
      .filter((record) => record.date.startsWith(period))
      .sort((a, b) => b.date.localeCompare(a.date))
    const start = (page - 1) * perPage
    const visibleRecords = records.slice(start, start + perPage)
    return {
      period,
      summary: summaryFromRecords(records),
      calendar: records.map((record) => ({ date: record.date, status: record.status })),
      records: visibleRecords,
      meta: { page, per_page: perPage, total: records.length, total_pages: Math.ceil(records.length / perPage) },
    }
  }

  const result = await apiRequest<AbsensiRiwayat>('absensi/riwayat', {
    params: { periode: period, page, per_page: perPage },
  })
  return {
    period: result.data.periode,
    summary: {
      workDays: result.data.ringkasan.hari_kerja,
      present: result.data.ringkasan.hadir,
      late: result.data.ringkasan.terlambat,
      permission: result.data.ringkasan.izin,
      sick: result.data.ringkasan.sakit,
      leave: result.data.ringkasan.cuti,
      absent: result.data.ringkasan.alpha,
    },
    calendar: result.data.kalender.map((item) => ({
      date: item.tanggal,
      status: apiStatusToUi[item.status] ?? (() => {
        throw new ApiError(0, 'INVALID_ATTENDANCE_STATUS', `Status absensi "${item.status}" tidak dikenal.`)
      })(),
    })),
    records: result.data.riwayat.map((item) =>
      attendanceRecord(item.tanggal, item.jam_masuk, item.jam_pulang, item.status),
    ),
    ...(result.meta ? { meta: result.meta } : {}),
  }
}

export async function listAttendanceRecords(period?: string): Promise<EmployeeAttendanceRecord[]> {
  if (config.mock.absensi) {
    const records = await listAttendanceRecordsMock()
    return period ? records.filter((record) => record.date.startsWith(period)) : records
  }
  const attendanceToday = await fetchAttendanceToday()
  const history = await getAttendanceHistory(period ?? attendanceToday.tanggal.slice(0, 7))
  return history.records
}

export async function recordCheckIn(
  date: Date,
  location: AbsensiLokasiRequest | undefined,
): Promise<EmployeeAttendanceRecord & { checkIn: string }> {
  if (config.mock.absensi) return recordCheckInMock(date)
  if (!location) throw new Error('Lokasi perangkat diperlukan untuk melakukan absensi.')
  const result = await apiRequest<CheckInResponse>('absensi/check-in', { method: 'POST', body: location })
  latestAttendanceStatus = apiStatusToUi[result.data.status]
  return {
    ...attendanceRecord(result.data.tanggal, result.data.jam_masuk, null, result.data.status),
    checkIn: toUiTime(result.data.jam_masuk) ?? '',
  }
}

export async function recordCheckOut(
  date: Date,
  location: AbsensiLokasiRequest | undefined,
): Promise<EmployeeAttendanceRecord & { checkIn: string; checkOut: string }> {
  if (config.mock.absensi) return recordCheckOutMock(date)
  if (!location) throw new Error('Lokasi perangkat diperlukan untuk melakukan absensi.')
  const result = await apiRequest<CheckOutResponse>('absensi/check-out', { method: 'POST', body: location })
  const dateKey = latestServerDate ?? getLocalDateKey()
  if (!latestAttendanceStatus) {
    throw new ApiError(0, 'ATTENDANCE_STATUS_UNAVAILABLE', 'Status absensi harus dimuat dari server sebelum absen pulang.')
  }
  const record = attendanceRecord(dateKey, result.data.jam_masuk, result.data.jam_pulang, latestAttendanceStatus)
  return {
    ...record,
    checkIn: toUiTime(result.data.jam_masuk) ?? '',
    checkOut: toUiTime(result.data.jam_pulang) ?? '',
  }
}

export async function submitAttendanceCorrection(
  correction: Omit<AttendanceCorrection, 'id' | 'submittedAt' | 'status' | 'isMock'>,
  submittedAt = new Date(),
): Promise<AttendanceCorrection> {
  if (config.mock.absensi) return submitAttendanceCorrectionMock(correction, submittedAt)
  const result = await apiRequest<PengajuanItem>('pengajuan', {
    method: 'POST',
    body: {
      jenis: 'koreksi_absensi',
      tanggal_mulai: correction.date,
      [`jam_${correction.field.toLowerCase()}_benar`]: toApiTime(correction.correctedTime),
      alasan: correction.reason,
    },
  })
  const detail = await apiRequest<PengajuanDetail>(`pengajuan/${result.data.id}`)
  return correctionFromRequest(result.data, detail.data)
}

export async function listAttendanceCorrections(): Promise<AttendanceCorrection[]> {
  if (config.mock.absensi) return listAttendanceCorrectionsMock()
  const result = await apiRequest<PengajuanItem[]>('pengajuan', {
    params: { jenis: 'koreksi_absensi', per_page: 100 },
  })
  return Promise.all(result.data.map(async (item) => {
    const detail = await apiRequest<PengajuanDetail>(`pengajuan/${item.id}`)
    return correctionFromRequest(item, detail.data)
  }))
}

export async function decideAttendanceCorrection(
  id: string,
  status: 'Disetujui' | 'Ditolak',
  approvedBy: string,
  rejectionReason = '',
): Promise<AttendanceCorrection> {
  if (config.mock.absensi) {
    return decideAttendanceCorrectionMock(id, status, approvedBy, rejectionReason)
  }
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId < 1) {
    throw new ApiError(0, 'INVALID_RESOURCE_ID', 'ID pengajuan harus berupa bilangan bulat positif dari API.')
  }
  const result = status === 'Disetujui'
    ? await apiRequest<PengajuanItem>(`pengajuan/${numericId}/setujui`, { method: 'POST', body: {} })
    : await apiRequest<PengajuanItem>(`pengajuan/${numericId}/tolak`, {
        method: 'POST',
        body: { alasan_penolakan: rejectionReason },
      })
  const detail = await apiRequest<PengajuanDetail>(`pengajuan/${numericId}`)
  return correctionFromRequest(result.data, detail.data)
}

export async function listAdminDailyAttendance(query: AbsensiAdminQuery): Promise<AdminAttendancePage> {
  if (config.mock.absensi) {
    const items = await listAdminDailyAttendanceMock(query.tanggal ?? getLocalDateKey())
    return {
      items,
      summary: {
        hadir: items.filter((item) => item.status === 'Hadir').length,
        terlambat: items.filter((item) => item.status === 'Terlambat').length,
        izin: items.filter((item) => item.status === 'Izin').length,
        sakit: items.filter((item) => item.status === 'Sakit').length,
        cuti: items.filter((item) => item.status === 'Cuti').length,
        alpha: items.filter((item) => item.status === 'Alpha').length,
      },
    }
  }
  const result = await apiRequest<AbsensiAdminItem[], { ringkasan: AbsensiAdminSummary }>('absensi', {
    params: { ...query },
  })
  const items = result.data.map((item) => {
    const status = item.status ? apiStatusToUi[item.status] : null
    if (item.status && !status) throw new ApiError(0, 'INVALID_ATTENDANCE_STATUS', `Status absensi "${item.status}" tidak dikenal.`)
    return {
      employeeId: String(item.karyawan.id),
      date: item.tanggal,
      checkIn: toUiTime(item.jam_masuk),
      checkOut: toUiTime(item.jam_pulang),
      status,
      name: item.karyawan.nama,
      initials: item.karyawan.inisial,
      position: '',
      department: item.departemen,
      location: item.lokasi ? `${item.lokasi.latitude}, ${item.lokasi.longitude}` : null,
      durationMinutes: item.durasi_menit,
      isMock: false,
    }
  })
  return {
    items,
    summary: result.ringkasan,
    ...(result.meta ? { meta: result.meta } : {}),
  }
}

export async function getMonthlyAttendanceSummary(query: AbsensiRekapQuery): Promise<MonthlyAttendancePage> {
  if (config.mock.absensi) {
    const items = await getMonthlyAttendanceSummaryMock(query.periode)
    const total = items.length
    const workDays = items.reduce((sum, item) => sum + item.workDays, 0)
    const present = items.reduce((sum, item) => sum + item.present, 0)
    return {
      period: query.periode,
      summary: {
        total_karyawan: total,
        rata_rata_hadir_persen: workDays ? (present / workDays) * 100 : 0,
        total_terlambat: items.reduce((sum, item) => sum + item.late, 0),
        total_alpha: items.reduce((sum, item) => sum + item.absent, 0),
        total_jam_lembur: items.reduce((sum, item) => sum + item.overtimeMinutes, 0) / 60,
      },
      items,
    }
  }
  const result = await apiRequest<AbsensiRekap>('absensi/rekap', { params: { ...query } })
  const items = result.data.karyawan.map((item) => ({
    employeeId: String(item.karyawan_id),
    period: result.data.periode,
    workDays: item.hari_kerja,
    present: item.hadir,
    late: item.terlambat,
    permission: item.izin,
    sick: item.sakit,
    leave: item.cuti,
    absent: item.alpha,
    overtimeMinutes: item.jam_lembur_menit,
    lateMinutes: item.total_menit_terlambat,
    name: item.nama,
    initials: item.nama.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    position: '',
    department: item.departemen,
    isMock: false,
  }))
  return {
    period: result.data.periode,
    summary: result.data.ringkasan,
    items,
    ...(result.meta ? { meta: result.meta } : {}),
  }
}

export async function exportAdminAttendance(params: AbsensiExportQuery): Promise<Blob> {
  if (config.mock.absensi) throw new ApiError(0, 'MOCK_EXPORT_UNAVAILABLE', 'Ekspor data tidak tersedia untuk tampilan saat ini.')
  return apiBlob('absensi/export', { params })
}
