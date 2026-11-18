'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, Clock3, Users, Wallet } from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { buttonVariants } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { formatRupiah } from '@/lib/mock-data'
import { getOwnerDashboardData } from '@/lib/services/report-service'

type OwnerData = Awaited<ReturnType<typeof getOwnerDashboardData>>

export function OwnerDashboard() {
  const [data, setData] = useState<OwnerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getOwnerDashboardData()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Ringkasan pemilik gagal dimuat.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])

  if (loading) return <PageLoadingSkeleton label="dashboard pemilik" />
  if (error) return <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
  if (!data) return <EmptyState title="Ringkasan belum tersedia" description="Muat ulang untuk mencoba kembali." icon={Wallet} />

  return (
    <div className="flex flex-col gap-6">
      <DemoDataNotice>
        Ringkasan ini memakai data demo. Total November mengikuti nilai penggajian Rp186.450.000; riwayat enam bulan dan rincian departemen adalah contoh.
      </DemoDataNotice>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">Ringkasan Pemilik</h2>
          <p className="mt-1 text-sm text-muted-foreground">Biaya gaji, kehadiran, dan keterlambatan periode November 2026.</p>
        </div>
        <Link href="/app/laporan" className={buttonVariants({ variant: 'primary', size: 'action' })}>
          Buka laporan
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total biaya gaji" value={formatRupiah(data.payrollTotal)} hint="Periode November 2026" icon={Wallet} highlight />
        <StatCard label="Karyawan" value={String(data.employeeCount)} hint="Termasuk agregat data demo" icon={Users} tone="blue" />
        <StatCard label="Status penggajian" value={data.payrollStatus} hint="Periode November 2026" icon={Clock3} tone="amber" />
      </div>

      <Panel className="min-w-0" title="Tren beban gaji" description="Enam bulan terakhir. Riwayat sebelum November merupakan data contoh.">
        {data.payrollTrend.length ? (
          <div className="h-72 min-w-0" role="img" aria-label="Grafik tren beban gaji enam bulan">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.payrollTrend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                <YAxis
                  domain={['dataMin - 1000000', 'dataMax + 1000000']}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(value: number) => `${Math.round(value / 1_000_000)} jt`}
                  width={48}
                />
                <Tooltip
                  formatter={(value) => [formatRupiah(Number(value)), 'Beban gaji']}
                  contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 13 }}
                />
                <Bar dataKey="amount" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="Tren belum tersedia" description="Belum ada data beban gaji untuk ditampilkan." icon={Wallet} />
        )}
      </Panel>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Panel className="min-w-0" title="Kehadiran per departemen" description="Jumlah hadir dan terlambat pada 17 Nov 2026, data contoh.">
          {data.attendanceByDepartment.length ? (
            <div className="h-72 min-w-0" role="img" aria-label="Grafik kehadiran per departemen">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.attendanceByDepartment} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="department" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 13 }} />
                  <Bar dataKey="present" name="Hadir" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="late" name="Terlambat" fill="var(--warning)" radius={[5, 5, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Rekap departemen belum tersedia" description="Belum ada data kehadiran untuk ditampilkan." icon={Users} />
          )}
        </Panel>

        <Panel
          title="Keterlambatan terbanyak"
          description="Rekap menit dari dataset demo November 2026."
          className="min-w-0"
        >
          {data.tardiness.length ? (
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-sm">
                <caption className="sr-only">Daftar keterlambatan terbanyak</caption>
                <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-3">Karyawan</th>
                    <th scope="col" className="px-3 py-3">Departemen</th>
                    <th scope="col" className="px-3 py-3">Hari terlambat</th>
                    <th scope="col" className="px-3 py-3">Total menit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.tardiness.map((item) => (
                    <tr key={item.employeeId}>
                      <th scope="row" className="px-3 py-3 font-semibold text-heading">{item.employeeName}</th>
                      <td className="px-3 py-3">{item.department}</td>
                      <td className="px-3 py-3 tabular-nums">{item.lateDays}</td>
                      <td className="px-3 py-3 tabular-nums">{item.lateMinutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Belum ada keterlambatan" description="Daftar karyawan terlambat akan tampil di sini." icon={Clock3} />
          )}
        </Panel>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/app/laporan/beban-gaji" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
          Lihat beban gaji
        </Link>
        <Link href="/app/laporan/keterlambatan" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
          Lihat keterlambatan
        </Link>
      </div>
    </div>
  )
}
