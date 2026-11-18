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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { Button, buttonVariants } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { useAccountingRole } from '@/lib/hooks/use-accounting-role'
import { formatRupiah } from '@/lib/mock-data'
import type { ReportId } from '@/lib/mock/reports'
import type { ReportDataset, ReportRow } from '@/lib/services/report-service'
import {
  getReportDataset,
  listReportCatalog,
  reportDepartmentOptions,
  reportOptions,
} from '@/lib/services/report-service'

const initialPeriod = '2026-11'

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

function csvEscape(value: string | number) {
  const text = String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function exportCsv(dataset: ReportDataset, period: string) {
  const columns = dataset.columns.length
    ? dataset.columns
    : [{ key: 'informasi', label: 'Informasi' }]
  const rows = dataset.columns.length
    ? dataset.rows
    : [{ informasi: dataset.emptyDescription }]
  const csv = [
    columns.map((column) => csvEscape(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column.key] ?? '')).join(',')),
  ].join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `laporan-${period}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportPdf() {
  const removePrintMode = () => document.body.classList.remove('report-print-mode')
  document.body.classList.add('report-print-mode')
  window.addEventListener('afterprint', removePrintMode, { once: true })
  window.print()
}

function ReportAccess({ children }: { children: React.ReactNode }) {
  const role = useAccountingRole()
  if (role === undefined) return <PageLoadingSkeleton label="laporan" />
  if (role === 'karyawan' || role === null) {
    return (
      <EmptyState
        title="Laporan untuk Admin, Keuangan, dan Pemilik"
        description="Masuk dengan mode demo Admin/HRD, Keuangan, atau Pemilik untuk melihat laporan."
        icon={FileChartColumn}
        action={<Link href="/login" className={buttonVariants({ variant: 'primary', size: 'action' })}>Pilih mode demo</Link>}
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
        <DemoDataNotice>
          Laporan memakai data demo. Rincian departemen dan tren historis adalah contoh, sedangkan penggajian dan jurnal mengikuti data tersimpan di aplikasi.
        </DemoDataNotice>
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
                  <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
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
  const [department, setDepartment] = useState('Semua departemen')
  const [dataset, setDataset] = useState<ReportDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const reportKey = isReportId(reportId) ? reportId : null

  useEffect(() => {
    if (!reportKey) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    getReportDataset(reportKey, period, department)
      .then((result) => {
        if (active) setDataset(result)
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
  }, [reportKey, period, department, retry])

  const title = reportOptions.find((report) => report.id === reportId)?.title ?? 'Laporan'
  const chartData = useMemo(() => dataset?.chart ?? [], [dataset])

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
      <div className="report-print-document flex flex-col gap-6">
        <DemoDataNotice>
          Data laporan bersifat demo. Data November 2026 menggunakan sumber HADIRPAY yang tersedia; riwayat lain ditandai sebagai contoh.
        </DemoDataNotice>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-heading">{dataset.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{dataset.description}</p>
            <p className="mt-1 text-sm text-muted-foreground">Periode {period} · {department}</p>
          </div>
          <div className="report-print-hide flex flex-wrap gap-3">
            <Link href="/app/laporan" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
              Daftar laporan
            </Link>
            <Button type="button" variant="outline" size="action" onClick={() => {
              try {
                exportCsv(dataset, period)
                toast.success('File CSV berhasil disiapkan untuk Excel.')
              } catch (exportError) {
                toast.error(exportError instanceof Error ? exportError.message : 'Ekspor CSV gagal.')
              }
            }}>
              Ekspor Excel
            </Button>
            <Button type="button" variant="primary" size="action" onClick={exportPdf}>Ekspor PDF</Button>
          </div>
        </div>

        <div className="report-print-hide grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
            Periode
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
            Departemen
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
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
                    domain={chartData.some((point) => point.value >= 1_000_000)
                      ? ['dataMin - 1000000', 'dataMax + 1000000']
                      : [0, 'auto']}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(value: number) => value >= 1_000_000 ? `${Math.round(value / 1_000_000)} jt` : String(value)}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value) => [typeof value === 'number' && value >= 1_000_000 ? formatRupiah(value) : value, 'Nilai']}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Grafik belum tersedia" description={dataset.emptyDescription} icon={BarChart3} />
          )}
        </Panel>

        <Panel className="min-w-0" title="Rincian laporan" description={`${dataset.rows.length} baris data untuk periode yang dipilih.`}>
          {dataAvailable && dataset.columns.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <caption className="sr-only">{dataset.title}, periode {period}</caption>
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
        </Panel>

        {dataset.title === 'Beban Gaji' && (
          <p className="text-xs text-muted-foreground">Nilai historis Juni sampai Oktober 2026 merupakan data contoh. November mengikuti total gaji demo Rp186.450.000.</p>
        )}
      </div>
    </ReportAccess>
  )
}
