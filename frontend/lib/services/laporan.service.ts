import { apiBlob, apiRequest, ApiError, type ApiMeta } from '@/lib/api/client'
import { config } from '@/lib/config'
import type { ReportId as MockReportId } from '@/lib/mock/reports'
import type { LaporanData, LaporanGrafikDua, LaporanQuery } from '@/lib/types/laporan'
import type { ReportDataset, ReportMetric, ReportRow } from './report-service'
import {
  getFinanceDashboardData as getFinanceDashboardDataMock,
  getOwnerDashboardData as getOwnerDashboardDataMock,
  getReportDataset as getReportDatasetMock,
  listReportCatalog as listReportCatalogMock,
  reportDepartmentOptions,
  reportOptions,
  type ReportDataset as LegacyReportDataset,
} from './report-service'
import { formatRupiah } from '@/lib/mock-data'
import type { ReportId as LegacyReportId } from '@/lib/mock/reports'
import type { DataMasterItem } from '@/lib/types/karyawan'

export { reportDepartmentOptions, reportOptions }
export type { ReportDataset, ReportMetric, ReportRow }
export type ReportId = MockReportId
export type ReportQuery = LaporanQuery

const endpointByReport: Record<ReportId, string> = {
  kehadiran: 'kehadiran',
  keterlambatan: 'keterlambatan',
  'izin-cuti': 'izin-cuti',
  lembur: 'lembur',
  'penggajian-bulanan': 'penggajian',
  'beban-gaji': 'beban-gaji',
  'jurnal-penggajian': 'jurnal-penggajian',
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/(^|\s)\S/g, (value) => value.toLocaleUpperCase('id-ID'))
}

function metricIcon(key: string): ReportMetric['icon'] {
  if (key.includes('hadir')) return 'check'
  if (key.includes('terlambat') || key.includes('menit') || key.includes('kejadian')) return 'clock'
  if (key.includes('periode') || key.includes('hari') || key.includes('jam')) return 'calendar'
  if (key.includes('gaji') || key.includes('upah') || key.includes('beban') || key.includes('debit') || key.includes('kredit')) return 'wallet'
  if (key.includes('karyawan') || key.includes('jumlah')) return 'users'
  return 'file'
}

function toRows(data: LaporanData): { columns: ReportDataset['columns']; rows: ReportRow[] } {
  const keys = [...new Set(data.tabel.flatMap((row) => Object.keys(row)))]
  const rows = [...data.tabel] as ReportRow[]
  if (rows.some((row) => typeof row.karyawan_id === 'number')) {
    rows.sort((a, b) => Number(a.karyawan_id) - Number(b.karyawan_id))
  }
  return {
    columns: keys.map((key) => ({ key, label: titleCase(key) })),
    rows,
  }
}

async function departmentId(name: string) {
  if (name === 'Semua departemen') return undefined
  const result = await apiRequest<DataMasterItem[]>('departemen')
  const department = result.data.find((item) => item.nama === name)
  if (!department) throw new ApiError(0, 'MASTER_DATA_NOT_FOUND', `Departemen "${name}" tidak ditemukan.`)
  return department.id
}

function fullMonthFromDateRange(dateFrom?: string, dateTo?: string) {
  if (!dateFrom || !dateTo) return undefined
  const period = dateFrom.slice(0, 7)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return undefined
  const [year, month] = period.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return dateFrom === `${period}-01` && dateTo === `${period}-${String(lastDay).padStart(2, '0')}`
    ? period
    : undefined
}

export async function listReportCatalog() {
  return listReportCatalogMock()
}

export async function getReportDataset(
  id: ReportId,
  query: LaporanQuery,
  department: string,
): Promise<LegacyReportDataset> {
  const page = query.page ?? 1
  const perPage = query.per_page ?? 20
  if (config.mock.laporan) {
    const mockPeriod = query.periode ??
      (query.periode_dari === query.periode_sampai ? query.periode_dari : undefined) ??
      fullMonthFromDateRange(query.tanggal_dari, query.tanggal_sampai)
    if (!mockPeriod) {
      const base = await getReportDatasetMock(id, '2026-11', department)
      return {
        ...base,
        columns: [],
        rows: [],
        metrics: [],
        chart: [],
        emptyDescription: 'Laporan belum mendukung rentang yang dipilih.',
        pagination: { page, per_page: perPage, total: 0, total_pages: 1 },
      }
    }
    const dataset = await getReportDatasetMock(id, mockPeriod, department)
    const total = dataset.rows.length
    const start = (page - 1) * perPage
    return {
      ...dataset,
      rows: dataset.rows.slice(start, start + perPage),
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      },
    }
  }
  const selectedDepartmentId = await departmentId(department)
  const result = await apiRequest<LaporanData>(`laporan/${endpointByReport[id]}`, {
    params: {
      ...query,
      departemen_id: selectedDepartmentId,
    },
  })
  const definition = reportOptions.find((item) => item.id === id)
  if (!definition) throw new ApiError(0, 'REPORT_NOT_FOUND', 'Jenis laporan tidak ditemukan.')
  const { columns, rows } = toRows(result.data)
  const metrics = Object.entries(result.data.ringkasan).map(([key, value]) => ({
    label: titleCase(key),
    value: typeof value === 'number' && (key.includes('gaji') || key.includes('upah') || key.includes('beban'))
      ? formatRupiah(value)
      : String(value ?? ''),
    hint: '',
    icon: metricIcon(key),
  }))
  const chart = result.data.grafik.map((item) => 'nilai' in item
    ? { label: item.label, value: item.nilai }
    : {
        label: item.label,
        valueA: (item as LaporanGrafikDua).nilai_a,
        valueB: (item as LaporanGrafikDua).nilai_b,
      })
  const meta = result.meta
  if (!meta) {
    throw new ApiError(200, 'INVALID_RESPONSE', 'Respons laporan tidak menyertakan metadata pagination.')
  }
  return {
    ...definition,
    columns,
    rows,
    metrics,
    chartTitle: definition.title,
    chart,
    emptyDescription: rows.length ? '' : 'Belum ada data untuk filter yang dipilih.',
    pagination: meta satisfies ApiMeta,
  }
}

export async function exportReport(
  id: ReportId,
  params: LaporanQuery,
  format: 'pdf' | 'xlsx',
  department = 'Semua departemen',
): Promise<Blob> {
  if (config.mock.laporan) throw new ApiError(0, 'MOCK_EXPORT_UNAVAILABLE', 'Ekspor tidak tersedia untuk tampilan saat ini.')
  const selectedDepartmentId = await departmentId(department)
  return apiBlob(`laporan/${endpointByReport[id]}/export`, {
    params: {
      ...params,
      departemen_id: selectedDepartmentId,
      format,
      page: 1,
      per_page: 500,
    },
  })
}

export async function getOwnerDashboardData() {
  if (config.mock.laporan) return getOwnerDashboardDataMock()
  return apiRequest('dashboard/pemilik').then((result) => result.data)
}

export async function getFinanceDashboardData() {
  if (config.mock.laporan) return getFinanceDashboardDataMock()
  return apiRequest('dashboard/keuangan').then((result) => result.data)
}
