'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Clock3, UserCheck, Users } from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { Avatar } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { SelectField } from '@/components/ui/select-field'
import { TextField } from '@/components/auth/fields'
import { Button } from '@/components/ui/button'
import type { MasterRecord } from '@/lib/mock/master-data'
import { config } from '@/lib/config'
import { listMasterRecords } from '@/lib/services/karyawan.service'
import {
  getMonthlyAttendanceSummary,
  type MonthlyAttendanceSummaryRow,
  type MonthlyAttendancePage,
} from '@/lib/services/absensi.service'

const defaultPeriod = '2026-11'
const pageSize = 20

function formatMonth(period: string) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function formatMinutes(minutes: number) {
  return `${Math.floor(minutes / 60)} jam ${String(minutes % 60).padStart(2, '0')} menit`
}

export function AttendanceRecapPage() {
  const [period, setPeriod] = useState(defaultPeriod)
  const [records, setRecords] = useState<MonthlyAttendanceSummaryRow[]>([])
  const [departments, setDepartments] = useState<MasterRecord[]>([])
  const [department, setDepartment] = useState('Semua')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [summary, setSummary] = useState<MonthlyAttendancePage['summary'] | null>(null)
  const [meta, setMeta] = useState<MonthlyAttendancePage['meta']>(undefined)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const departmentData = await listMasterRecords('departemen')
      const departmentId = department === 'Semua'
        ? undefined
        : Number(departmentData.find((item) => item.name === department)?.id)
      if (department !== 'Semua' && (!Number.isSafeInteger(departmentId) || Number(departmentId) < 1)) {
        throw new Error(`ID departemen untuk "${department}" tidak valid.`)
      }
      const result = await getMonthlyAttendanceSummary({
        periode: period,
        departemen_id: departmentId,
        search: debouncedSearch.trim() || undefined,
        page,
        per_page: pageSize,
      })
      setDepartments(departmentData)
      setRecords(result.items)
      setSummary(result.summary)
      setMeta(result.meta)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Rekap kehadiran gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [period, department, debouncedSearch, page])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const filteredRecords = useMemo(() => {
    if (!config.mock.absensi) return records
    const query = search.trim().toLocaleLowerCase('id-ID')
    return records.filter((record) =>
      (department === 'Semua' || record.department === department) &&
      (!query || `${record.name} ${record.employeeId} ${record.department}`.toLocaleLowerCase('id-ID').includes(query)),
    )
  }, [department, records, search])
  const visibleRecords = config.mock.absensi
    ? filteredRecords.slice((page - 1) * pageSize, page * pageSize)
    : records
  const totalCount = config.mock.absensi ? filteredRecords.length : meta?.total ?? records.length
  const pageCount = config.mock.absensi
    ? Math.max(1, Math.ceil(totalCount / pageSize))
    : meta?.total_pages ?? 1

  if (loading) return <PageLoadingSkeleton label="rekap kehadiran bulanan" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <DemoDataNotice>
        Rekap ini menggunakan data contoh untuk karyawan aktif di direktori demo. Angka berubah mengikuti periode yang tersedia.
      </DemoDataNotice>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">Rekap kehadiran bulanan</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ringkasan kehadiran per karyawan untuk {formatMonth(period)}.</p>
        </div>
        <Link
          href="/app/absensi"
          className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}
        >
          <ArrowLeft aria-hidden="true" />
          Kembali ke absensi
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
        <label htmlFor="attendance-recap-period" className="mb-2 block text-sm font-semibold text-heading">Periode</label>
        <input
          id="attendance-recap-period"
          type="month"
          required
          value={period}
          onChange={(event) => {
            if (event.target.value) {
              setPeriod(event.target.value)
              setPage(1)
            }
          }}
          className="min-h-12 w-full rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        />
        </div>
        <SelectField
          label="Departemen"
          value={department}
          onChange={(value) => {
            setDepartment(value || 'Semua')
            setPage(1)
          }}
          options={['Semua', ...departments.map((item) => item.name)]}
          placeholder="Pilih departemen"
        />
        <TextField
          label="Cari karyawan"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Karyawan" value={String(summary?.total_karyawan ?? 0)} hint={`Periode ${formatMonth(period)}`} icon={Users} tone="blue" />
        <StatCard label="Rata-rata hadir" value={`${summary?.rata_rata_hadir_persen ?? 0}%`} hint={`Periode ${formatMonth(period)}`} icon={UserCheck} tone="green" />
        <StatCard label="Keterlambatan" value={String(summary?.total_terlambat ?? 0)} hint="Kejadian tercatat" icon={Clock3} tone="amber" />
        <StatCard label="Total alpha" value={String(summary?.total_alpha ?? 0)} hint="Periode terpilih" icon={CalendarDays} tone="red" />
      </div>

      <Panel title={`Rincian ${formatMonth(period)}`} description="Jumlah status, jam lembur, dan akumulasi menit terlambat per karyawan.">
        {totalCount === 0 ? (
          <EmptyState
            title="Rekap periode ini belum tersedia"
            description="Pilih November 2026 untuk melihat rekap contoh yang tersedia."
            icon={CalendarDays}
          />
        ) : (
          <>
            <div className="no-scrollbar hidden overflow-x-auto rounded-xl border border-border xl:block">
              <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
                <caption className="sr-only">Rekapitulasi absensi karyawan untuk {formatMonth(period)}</caption>
                <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-3">Karyawan</th>
                    <th scope="col" className="px-3 py-3">Hari kerja</th>
                    <th scope="col" className="px-3 py-3">Hadir</th>
                    <th scope="col" className="px-3 py-3">Terlambat</th>
                    <th scope="col" className="px-3 py-3">Izin</th>
                    <th scope="col" className="px-3 py-3">Sakit</th>
                    <th scope="col" className="px-3 py-3">Cuti</th>
                    <th scope="col" className="px-3 py-3">Alpha</th>
                    <th scope="col" className="px-3 py-3">Jam lembur</th>
                    <th scope="col" className="px-3 py-3">Menit terlambat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleRecords.map((record) => (
                    <tr key={record.employeeId} className="hover:bg-surface/70">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar initials={record.initials} tone="outlined" />
                          <div>
                            <p className="font-semibold text-heading">{record.name}</p>
                            <p className="text-xs text-muted-foreground">{record.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{record.workDays}</td>
                      <td className="px-3 py-3 tabular-nums">{record.present}</td>
                      <td className="px-3 py-3 tabular-nums">{record.late}</td>
                      <td className="px-3 py-3 tabular-nums">{record.permission}</td>
                      <td className="px-3 py-3 tabular-nums">{record.sick}</td>
                      <td className="px-3 py-3 tabular-nums">{record.leave}</td>
                      <td className="px-3 py-3 tabular-nums">{record.absent}</td>
                      <td className="px-3 py-3">{formatMinutes(record.overtimeMinutes)}</td>
                      <td className="px-3 py-3 tabular-nums">{record.lateMinutes} menit</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-3 xl:hidden" aria-label="Daftar rekap kehadiran karyawan">
              {visibleRecords.map((record) => (
                <li key={record.employeeId} className="rounded-xl border border-border bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Avatar initials={record.initials} tone="outlined" />
                    <div>
                      <p className="font-semibold text-heading">{record.name}</p>
                      <p className="text-sm text-muted-foreground">{record.department} · {record.workDays} hari kerja</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-muted-foreground">Hadir</dt><dd className="font-semibold">{record.present}</dd></div>
                    <div><dt className="text-muted-foreground">Terlambat</dt><dd className="font-semibold">{record.late}</dd></div>
                    <div><dt className="text-muted-foreground">Izin</dt><dd className="font-semibold">{record.permission}</dd></div>
                    <div><dt className="text-muted-foreground">Sakit</dt><dd className="font-semibold">{record.sick}</dd></div>
                    <div><dt className="text-muted-foreground">Cuti</dt><dd className="font-semibold">{record.leave}</dd></div>
                    <div><dt className="text-muted-foreground">Alpha</dt><dd className="font-semibold">{record.absent}</dd></div>
                    <div><dt className="text-muted-foreground">Jam lembur</dt><dd className="font-semibold">{formatMinutes(record.overtimeMinutes)}</dd></div>
                    <div><dt className="text-muted-foreground">Menit terlambat</dt><dd className="font-semibold">{record.lateMinutes}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">Halaman {page} dari {pageCount}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="action" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                Sebelumnya
              </Button>
              <Button type="button" variant="outline" size="action" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
