'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  BookOpenText,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileChartColumn,
  FileCheck2,
  Timer,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatIcon } from '@/components/ui/stat-icon'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { useAccountingRole } from '@/lib/hooks/use-accounting-role'
import { formatRupiah } from '@/lib/mock-data'
import type { ReportId } from '@/lib/mock/reports'
import type { ReportDataset, ReportRow } from '@/lib/services/report-service'
import type { ReportQuery } from '@/lib/services/laporan.service'
import {
  getReportDataset,
  listReportCatalog,
  reportDepartmentOptions,
  reportOptions,
  exportReport,
} from '@/lib/services/laporan.service'

const initialPeriod = '2026-11'
const reportPageSize = 20

const reportIcons = {
  kehadiran: CalendarCheck2,
  keterlambatan: Clock3,
  'izin-cuti': CalendarDays,
  lembur: Timer,
  'penggajian-bulanan': Wallet,
  'beban-gaji': BarChart3,
  'jurnal-penggajian': BookOpenText,
} satisfies Record<ReportId, typeof FileChartColumn>

const metricIcons = {
  users: ClipboardList,
  check: CalendarCheck2,
  clock: Clock3,
  calendar: CalendarDays,
  wallet: Wallet,
  file: FileCheck2,
  scale: BarChart3,
}

function isReportId(value: string): value is ReportId {
  return reportOptions.some((report) => report.id === value)
}

function cellValue(value: ReportRow[string]) {
  return typeof value === 'number' ? new Intl.NumberFormat('id-ID').format(value) : value
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ReportAccess({ children }: { children: React.ReactNode }) {
  const role = useAccountingRole()
  if (role === undefined) return <PageLoadingSkeleton label="laporan" />
  if (role === 'karyawan' || role === null) {
    return (
      <EmptyState
        title="Laporan untuk Admin, Keuangan, dan Pemilik"
        description="Masuk sebagai Admin/HRD, Keuangan, atau Pemilik untuk melihat laporan."
        icon={FileChartColumn}
        action={<Link href="/login" className={buttonVariants({ variant: 'primary', size: 'action' })}>Pilih role</Link>}
      />
    )
  }
  return children
}

export function ReportsIndexPage() {
  const role = useAccountingRole()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [catalog, setCatalog] = useState(reportOptions)

  useEffect(() => {
    let active = true
    listReportCatalog()
      .then((items) => {
        if (active) setCatalog(items)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Daftar laporan gagal dimuat.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (role === undefined || loading) return <PageLoadingSkeleton label="daftar laporan" />
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />

  return (
    <ReportAccess>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-heading">Laporan</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pilih laporan untuk meninjau angka dan rincian berdasarkan periode.</p>
        </div>
        {catalog.length === 0 ? (
          <EmptyState title="Belum ada laporan" description="Daftar laporan belum tersedia untuk akun ini." icon={FileChartColumn} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalog.map((report) => {
              const Icon = reportIcons[report.id]
              return (
                <Link
                  key={report.id}
                  href={`/app/laporan/${report.id}`}
                  className="group flex min-h-40 flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-6"
                >
                  <StatIcon icon={Icon} tone="primary" size="md" />
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="font-bold text-heading">{report.title}</span>
                    <span className="text-sm text-muted-foreground">{report.description}</span>
                  </span>
                  <span className="text-sm font-semibold text-primary">Buka laporan</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </ReportAccess>
  )
}

export function ReportDetailPage({ reportId }: { reportId: string }) {
  const role = useAccountingRole()
  const [period, setPeriod] = useState(initialPeriod)
  const [filterMode, setFilterMode] = useState<'periode' | 'rentang_periode' | 'rentang_tanggal'>('periode')
  const [periodFrom, setPeriodFrom] = useState(initialPeriod)
  const [periodTo, setPeriodTo] = useState(initialPeriod)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [department, setDepartment] = useState('Semua departemen')
  const [page, setPage] = useState(1)
  const [dataset, setDataset] = useState<ReportDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)
  const reportKey = isReportId(reportId) ? reportId : null

  useEffect(() => {
    if (!reportKey) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    const query: ReportQuery = {
      ...(filterMode === 'periode' ? { periode: period || undefined } : {}),
      ...(filterMode === 'rentang_periode'
        ? { periode_dari: periodFrom || undefined, periode_sampai: periodTo || undefined }
        : {}),
      ...(filterMode === 'rentang_tanggal'
        ? { tanggal_dari: dateFrom || undefined, tanggal_sampai: dateTo || undefined }
        : {}),
      page,
      per_page: reportPageSize,
    }
    getReportDataset(reportKey, query, department)
      .then((result) => {
        if (!active) return
        const totalPages = Math.max(1, result.pagination?.total_pages ?? 1)
        if (page > totalPages) {
          setPage(totalPages)
          return
        }
        setDataset(result)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Laporan gagal dimuat.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reportKey, filterMode, period, periodFrom, periodTo, dateFrom, dateTo, department, page, retry])

  const title = reportOptions.find((report) => report.id === reportId)?.title ?? 'Laporan'
  const chartData = useMemo(() => dataset?.chart ?? [], [dataset])
  const chartValues = chartData.flatMap((point) =>
    [point.value, point.valueA, point.valueB].filter((value): value is number => typeof value === 'number'),
  )
  const hasTwoSeries = chartData.some((point) => point.valueA !== undefined || point.valueB !== undefined)
  const filterLabel = filterMode === 'periode'
    ? period
    : filterMode === 'rentang_periode'
      ? `${periodFrom} s.d. ${periodTo}`
      : `${dateFrom || '...'} s.d. ${dateTo || '...'}`
  const pageCount = Math.max(1, dataset?.pagination?.total_pages ?? 1)

  async function handleExport(format: 'xlsx' | 'pdf') {
    if (!reportKey || exporting) return
    setExporting(format)
    const query: ReportQuery = {
      ...(filterMode === 'periode' ? { periode: period || undefined } : {}),
      ...(filterMode === 'rentang_periode'
        ? { periode_dari: periodFrom || undefined, periode_sampai: periodTo || undefined }
        : {}),
      ...(filterMode === 'rentang_tanggal'
        ? { tanggal_dari: dateFrom || undefined, tanggal_sampai: dateTo || undefined }
        : {}),
    }
    try {
      const blob = await exportReport(reportKey, query, format, department)
      const extension = format === 'xlsx' ? 'xlsx' : 'pdf'
      downloadBlob(blob, `laporan-${reportKey}-${filterLabel.replaceAll(' ', '-')}.${extension}`)
      toast.success(`Laporan ${format.toUpperCase()} berhasil diunduh.`)
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Ekspor laporan gagal.')
    } finally {
      setExporting(null)
    }
  }

  if (!reportKey) {
    return (
      <EmptyState
        title="Laporan tidak ditemukan"
        description="Pilih salah satu laporan dari daftar."
        icon={FileChartColumn}
        action={<Link href="/app/laporan" className={buttonVariants({ variant: 'primary', size: 'action' })}>Kembali ke laporan</Link>}
      />
    )
  }
  if (role === undefined || loading) return <PageLoadingSkeleton label={title.toLowerCase()} />
  if (error) return <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
  if (!dataset) return <EmptyState title="Laporan belum tersedia" description="Muat ulang untuk mencoba kembali." icon={FileChartColumn} />

  const dataAvailable = dataset.rows.length > 0

  return (
    <ReportAccess>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-heading">{dataset.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{dataset.description}</p>
            <p className="mt-1 text-sm text-muted-foreground">Periode {filterLabel} · {department}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-3">
            <Link href="/app/laporan" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
              Daftar laporan
            </Link>
            <Button type="button" variant="outline" size="action" disabled={exporting !== null} onClick={() => void handleExport('xlsx')}>
              {exporting === 'xlsx' ? 'Menyiapkan Excel…' : 'Ekspor Excel'}
            </Button>
            <Button type="button" variant="primary" size="action" disabled={exporting !== null} onClick={() => void handleExport('pdf')}>
              {exporting === 'pdf' ? 'Menyiapkan PDF…' : 'Ekspor PDF'}
            </Button>
            </div>
            <p className="text-xs text-muted-foreground">Ekspor memuat seluruh baris sesuai filter, bukan hanya halaman yang sedang dibuka.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
            Jenis periode
            <select
              value={filterMode}
              onChange={(event) => {
                setFilterMode(event.target.value as typeof filterMode)
                setPage(1)
              }}
              className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <option value="periode">Periode</option>
              <option value="rentang_periode">Rentang periode</option>
              <option value="rentang_tanggal">Rentang tanggal</option>
            </select>
          </label>
          {filterMode === 'periode' && (
            <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
              Periode
              <input
                type="month"
                value={period}
                onChange={(event) => { setPeriod(event.target.value); setPage(1) }}
                className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
            </label>
          )}
          {filterMode === 'rentang_periode' && (
            <>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Periode dari
                <input type="month" value={periodFrom} onChange={(event) => { setPeriodFrom(event.target.value); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Periode sampai
                <input type="month" value={periodTo} onChange={(event) => { setPeriodTo(event.target.value); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
              </label>
            </>
          )}
          {filterMode === 'rentang_tanggal' && (
            <>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Tanggal dari
                <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Tanggal sampai
                <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
              </label>
            </>
          )}
          <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
            Departemen
            <select
              value={department}
              onChange={(event) => { setDepartment(event.target.value); setPage(1) }}
              className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <option>Semua departemen</option>
              {reportDepartmentOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>

        {dataset.metrics.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {dataset.metrics.map((item) => {
              const Icon = metricIcons[item.icon]
              return <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} icon={Icon} />
            })}
          </div>
        )}

        <Panel className="min-w-0" title={dataset.chartTitle} description="Ringkasan visual sesuai periode dan departemen yang dipilih.">
          {chartData.length ? (
            <div className="h-72 min-w-0" role="img" aria-label={dataset.chartTitle}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                  <YAxis
                    domain={chartValues.some((value) => value >= 1_000_000)
                      ? ['dataMin - 1000000', 'dataMax + 1000000']
                      : [0, 'auto']}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(value: number) => value >= 1_000_000 ? `${Math.round(value / 1_000_000)} jt` : String(value)}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      typeof value === 'number' && value >= 1_000_000 ? formatRupiah(value) : value,
                      name === 'valueA' ? 'Nilai A' : name === 'valueB' ? 'Nilai B' : 'Nilai',
                    ]}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                  {hasTwoSeries ? (
                    <>
                      <Legend />
                      <Bar dataKey="valueA" name="Nilai A" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                      <Bar dataKey="valueB" name="Nilai B" fill="var(--success)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                    </>
                  ) : (
                    <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Grafik belum tersedia" description={dataset.emptyDescription} icon={BarChart3} />
          )}
        </Panel>

        <Panel className="min-w-0" title="Rincian laporan" description={`${dataset.pagination?.total ?? dataset.rows.length} baris data untuk filter yang dipilih.`}>
          {dataAvailable && dataset.columns.length ? (
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <caption className="sr-only">{dataset.title}, periode {filterLabel}</caption>
                <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>{dataset.columns.map((column) => <th key={column.key} scope="col" className="px-3 py-3">{column.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dataset.rows.map((row, index) => (
                    <tr key={`${reportId}-${index}`} className="text-foreground">
                      {dataset.columns.map((column) => <td key={column.key} className="px-3 py-3 align-top">{cellValue(row[column.key] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Belum ada data pada pilihan ini" description={dataset.emptyDescription} icon={FileCheck2} />
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Halaman {page} dari {pageCount} · {dataset.pagination?.total ?? dataset.rows.length} baris
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="action" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Sebelumnya</Button>
              <Button type="button" variant="outline" size="action" disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Berikutnya</Button>
            </div>
          </div>
        </Panel>

        {dataset.title === 'Beban Gaji' && (
          <p className="text-xs text-muted-foreground">Nilai historis Juni sampai Oktober 2026 tersedia sebagai referensi. November mengikuti total gaji Rp186.450.000.</p>
        )}
      </div>
    </ReportAccess>
  )
}
