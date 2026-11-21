'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Check,
  Clock3,
  Download,
  Inbox,
  MapPin,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { SelectField } from '@/components/ui/select-field'
import { TextField } from '@/components/auth/fields'
import { adminAttendanceDemoDate } from '@/lib/mock/admin-attendance'
import type { MasterRecord } from '@/lib/mock/master-data'
import type { ApprovalRequest } from '@/lib/mock/requests'
import type { EmployeeAttendanceStatus } from '@/lib/mock/attendance'
import { formatTanggal } from '@/lib/format'
import { config } from '@/lib/config'
import type { AbsensiAdminQuery } from '@/lib/types/absensi'
import { listMasterRecords } from '@/lib/services/karyawan.service'
import { decideRequest, listRequests } from '@/lib/services/pengajuan.service'
import {
  exportAdminAttendance,
  getAttendanceToday,
  listAdminDailyAttendance,
  type AdminDailyAttendanceRow,
} from '@/lib/services/absensi.service'

const adminName = 'Rina Kartika (HRD)'
const attendanceStatuses: EmployeeAttendanceStatus[] = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Cuti', 'Alpha', 'Dinas Luar']
const statusToApi: Record<EmployeeAttendanceStatus, NonNullable<AbsensiAdminQuery['status']>> = {
  Hadir: 'hadir',
  Terlambat: 'terlambat',
  Izin: 'izin',
  Sakit: 'sakit',
  Cuti: 'cuti',
  Alpha: 'alpha',
  'Dinas Luar': 'dinas_luar',
}
const pageSize = 20

function departmentIdForName(departments: MasterRecord[], name: string) {
  if (name === 'Semua') return undefined
  const parsed = Number(departments.find((item) => item.name === name)?.id)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`ID departemen untuk "${name}" tidak valid.`)
  }
  return parsed
}

function selectedStatus(value: string) {
  const status = attendanceStatuses.find((item) => item === value)
  return status ? statusToApi[status] : undefined
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return '-'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${String(hours).padStart(2, '0')} jam ${String(remainder).padStart(2, '0')} menit`
}

function escapeCsv(value: string) {
  const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safeValue.replaceAll('"', '""')}"`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

export function AdminAttendancePage() {
  const [records, setRecords] = useState<AdminDailyAttendanceRow[]>([])
  const [departments, setDepartments] = useState<MasterRecord[]>([])
  const [corrections, setCorrections] = useState<ApprovalRequest[]>([])
  const [selectedCorrection, setSelectedCorrection] = useState<ApprovalRequest | null>(null)
  const [date, setDate] = useState(config.mock.absensi ? adminAttendanceDemoDate : '')
  const [department, setDepartment] = useState('Semua')
  const [status, setStatus] = useState('Semua')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<{ total: number; total_pages: number } | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      if (!date) {
        if (config.mock.absensi) {
          setDate(adminAttendanceDemoDate)
          return
        }
        const today = await getAttendanceToday()
        if (!today) throw new Error('Tanggal hari ini tidak tersedia dari server absensi.')
        setDate(today.date)
        return
      }
      const departmentData = await listMasterRecords('departemen')
      const [attendancePage, requests] = await Promise.all([
        listAdminDailyAttendance({
          tanggal: date,
          departemen_id: departmentIdForName(departmentData, department),
          status: selectedStatus(status),
          search: debouncedSearch.trim() || undefined,
          page,
          per_page: pageSize,
        }),
        listRequests({ jenis: 'koreksi_absensi', page: 1, per_page: 100 }),
      ])
      setDepartments(departmentData)
      setRecords(attendancePage.items)
      setMeta(attendancePage.meta ? { total: attendancePage.meta.total, total_pages: attendancePage.meta.total_pages } : null)
      setCorrections(requests.filter((request) => request.type === 'Koreksi Absensi'))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Data kehadiran gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [date, department, status, debouncedSearch, page])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const filteredRecords = useMemo(() => {
    if (!config.mock.absensi) return records
    const query = search.trim().toLocaleLowerCase('id-ID')
    return records.filter((record) =>
      (department === 'Semua' || record.department === department) &&
      (status === 'Semua' || record.status === status) &&
      (!query || `${record.name} ${record.employeeId} ${record.department}`.toLocaleLowerCase('id-ID').includes(query)),
    )
  }, [department, records, search, status])
  const pageCount = config.mock.absensi
    ? Math.max(1, Math.ceil(filteredRecords.length / pageSize))
    : meta?.total_pages ?? 1
  const visibleRecords = config.mock.absensi
    ? filteredRecords.slice((page - 1) * pageSize, page * pageSize)
    : filteredRecords

  const pendingCorrections = corrections.filter((request) => request.status === 'Menunggu persetujuan')

  async function exportCsv() {
    if (config.mock.absensi && filteredRecords.length === 0) {
      toast.error('Tidak ada data untuk diekspor.')
      return
    }
    if (!config.mock.absensi) {
      try {
        const blob = await exportAdminAttendance({
          tanggal: date,
          departemen_id: departmentIdForName(departments, department),
          status: selectedStatus(status),
          search: debouncedSearch.trim() || undefined,
        })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `kehadiran-${date}.csv`
        anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        toast.success('Data kehadiran berhasil diekspor.')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ekspor data kehadiran gagal.')
      }
      return
    }
    const header = ['Tanggal', 'ID karyawan', 'Karyawan', 'Divisi', 'Masuk', 'Pulang', 'Durasi', 'Status', 'Lokasi']
    const rows = filteredRecords.map((record) => [
      formatDate(record.date),
      record.employeeId,
      record.name,
      record.department,
      record.checkIn ?? '',
      record.checkOut ?? '',
      record.durationMinutes === null ? '' : formatDuration(record.durationMinutes),
      record.status,
      record.location ?? '',
    ])
    const csv = [header, ...rows].map((row) => row.map((value) => escapeCsv(String(value))).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `kehadiran-${date}.csv`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Data kehadiran berhasil diekspor.')
  }

  function openCorrection(request: ApprovalRequest) {
    setSelectedCorrection(request)
    setRejectMode(false)
    setRejectionReason('')
  }

  async function decideCorrection(decision: 'Disetujui' | 'Ditolak') {
    if (!selectedCorrection || submitting) return
    if (decision === 'Ditolak' && !rejectionReason.trim()) {
      toast.error('Alasan penolakan wajib diisi.')
      return
    }
    setSubmitting(true)
    try {
      const updated = await decideRequest(selectedCorrection.id, decision, adminName, rejectionReason)
      setCorrections((current) => current.map((request) => request.id === updated.id ? updated : request))
      setSelectedCorrection(updated)
      setRejectMode(false)
      setRejectionReason('')
      toast.success(decision === 'Disetujui' ? 'Koreksi absensi disetujui.' : 'Koreksi absensi ditolak.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Koreksi absensi gagal diproses.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoadingSkeleton label="data kehadiran harian" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <DemoDataNotice>
        Data contoh menampilkan karyawan aktif yang tersedia di direktori demo. Perubahan keputusan koreksi tersimpan di browser ini dan ikut diperbarui di menu Pengajuan.
      </DemoDataNotice>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">Kehadiran harian</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Periksa jam kerja, lokasi, dan status kehadiran karyawan.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/absensi/rekap"
            className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}
          >
            <CalendarDays aria-hidden="true" />
            Lihat rekap bulanan
          </Link>
          <Button type="button" variant="primary" size="action" onClick={exportCsv}>
            <Download aria-hidden="true" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      <Panel title="Data kehadiran" description={`Data contoh untuk ${formatTanggal(date)}.`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="attendance-date" className="text-sm font-semibold text-heading">Tanggal</label>
            <input
              id="attendance-date"
              type="date"
              required
              value={date}
              onChange={(event) => {
                if (event.target.value) {
                  setDate(event.target.value)
                  setPage(1)
                }
              }}
              className="min-h-12 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </div>
          <SelectField
            label="Divisi"
            value={department}
            onChange={(value) => {
              setDepartment(value || 'Semua')
              setPage(1)
            }}
            options={['Semua', ...departments.map((item) => item.name)]}
            placeholder="Pilih divisi"
          />
          <SelectField
            label="Status"
            value={status}
            onChange={(value) => {
              setStatus(value || 'Semua')
              setPage(1)
            }}
            options={['Semua', ...attendanceStatuses]}
            placeholder="Pilih status"
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
          <div className="flex items-end text-sm text-muted-foreground">
            <p aria-live="polite">{filteredRecords.length} karyawan ditampilkan</p>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <EmptyState
            title={records.length === 0 ? 'Belum ada data kehadiran' : 'Tidak ada catatan yang cocok'}
            description={
              records.length === 0
                ? 'Data contoh tersedia untuk 17 Nov 2026. Pilih tanggal tersebut untuk melihat catatan.'
                : 'Ubah filter divisi atau status untuk melihat catatan lain.'
            }
            icon={records.length === 0 ? CalendarDays : Search}
          />
        ) : (
          <>
            <div className="no-scrollbar hidden overflow-x-auto rounded-xl border border-border xl:block">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <caption className="sr-only">Kehadiran karyawan pada {formatTanggal(date)}</caption>
                <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3">Karyawan</th>
                    <th scope="col" className="px-4 py-3">Divisi</th>
                    <th scope="col" className="px-4 py-3">Masuk</th>
                    <th scope="col" className="px-4 py-3">Pulang</th>
                    <th scope="col" className="px-4 py-3">Durasi</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Lokasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleRecords.map((record) => (
                    <tr key={record.employeeId} className="hover:bg-surface/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar initials={record.initials} tone="outlined" />
                          <div>
                            <p className="font-semibold text-heading">{record.name}</p>
                            <p className="text-xs text-muted-foreground">{record.employeeId} · {record.position}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{record.department}</td>
                      <td className="px-4 py-3 tabular-nums">{record.checkIn ?? '-'}</td>
                      <td className="px-4 py-3 tabular-nums">{record.checkOut ?? '-'}</td>
                      <td className="px-4 py-3">{formatDuration(record.durationMinutes)}</td>
                      <td className="px-4 py-3">
                        {record.status
                          ? <StatusBadge status={record.status} />
                          : <span className="text-muted-foreground" role="status">Belum absen</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          {record.location && <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                          {record.location ?? '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-3 xl:hidden" aria-label="Daftar kehadiran karyawan">
              {visibleRecords.map((record) => (
                <li key={record.employeeId} className="rounded-xl border border-border bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Avatar initials={record.initials} tone="outlined" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-heading">{record.name}</p>
                      <p className="text-sm text-muted-foreground">{record.employeeId} · {record.department}</p>
                      <div className="mt-3">
                        {record.status
                          ? <StatusBadge status={record.status} />
                          : <span className="text-sm text-muted-foreground" role="status">Belum absen</span>}
                      </div>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-muted-foreground">Masuk</dt><dd className="font-medium tabular-nums">{record.checkIn ?? '-'}</dd></div>
                    <div><dt className="text-muted-foreground">Pulang</dt><dd className="font-medium tabular-nums">{record.checkOut ?? '-'}</dd></div>
                    <div><dt className="text-muted-foreground">Durasi</dt><dd className="font-medium">{formatDuration(record.durationMinutes)}</dd></div>
                    <div><dt className="text-muted-foreground">Lokasi</dt><dd className="font-medium">{record.location ?? '-'}</dd></div>
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

      <Panel
        title="Koreksi absensi menunggu"
        description="Pengajuan koreksi dari karyawan. Keputusan di sini juga tampil pada menu Pengajuan."
      >
        {pendingCorrections.length === 0 ? (
          <EmptyState
            title={corrections.length === 0 ? 'Belum ada pengajuan koreksi' : 'Semua koreksi sudah diproses'}
            description="Koreksi absensi yang diajukan karyawan akan muncul di bagian ini."
            icon={Inbox}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingCorrections.map((request) => (
              <li key={request.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
                <Avatar initials={request.initials} tone="outlined" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-heading">{request.name}</p>
                  <p className="text-sm text-muted-foreground">{request.employeeId} · {request.department} · {formatDate(request.startDate)}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-foreground">{request.reason}</p>
                </div>
                <Button type="button" variant="outline" size="action" className="bg-white" onClick={() => openCorrection(request)}>
                  <Search aria-hidden="true" />
                  Lihat detail
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog
        open={Boolean(selectedCorrection)}
        onOpenChange={(open) => {
          if (!open) setSelectedCorrection(null)
        }}
        label="Detail koreksi absensi"
        size="lg"
      >
        {selectedCorrection && (
          <>
            <DialogHeader
              title="Detail koreksi absensi"
              description={`${selectedCorrection.name} · ${selectedCorrection.employeeId}`}
              onClose={() => setSelectedCorrection(null)}
            />
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{selectedCorrection.department} · {formatDate(selectedCorrection.startDate)}</p>
                <StatusBadge status={selectedCorrection.status} />
              </div>
              <div className="rounded-xl bg-surface p-4">
                <p className="text-sm font-semibold text-heading">Alasan dan waktu koreksi</p>
                <p className="mt-1 text-sm text-foreground">{selectedCorrection.reason}</p>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-4" aria-hidden="true" />
                Diajukan {formatDate(selectedCorrection.submittedAt)}
              </p>
              {selectedCorrection.status === 'Ditolak' && selectedCorrection.rejectionReason && (
                <p className="text-sm text-destructive">Alasan penolakan: {selectedCorrection.rejectionReason}</p>
              )}
              {rejectMode && selectedCorrection.status === 'Menunggu persetujuan' && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="attendance-correction-rejection" className="text-sm font-semibold text-heading">Alasan penolakan</label>
                  <textarea
                    id="attendance-correction-rejection"
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  />
                </div>
              )}
            </div>
            {selectedCorrection.status === 'Menunggu persetujuan' && (
              <DialogFooter>
                {rejectMode ? (
                  <>
                    <Button type="button" variant="outline" size="action" onClick={() => setRejectMode(false)} disabled={submitting}>Kembali</Button>
                    <Button
                      type="button"
                      variant="dangerOutline"
                      size="action"
                      disabled={submitting || !rejectionReason.trim()}
                      onClick={() => void decideCorrection('Ditolak')}
                    >
                      {submitting ? 'Menyimpan...' : 'Konfirmasi penolakan'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="dangerOutline" size="action" onClick={() => setRejectMode(true)}>
                      <X aria-hidden="true" />
                      Tolak
                    </Button>
                    <Button type="button" variant="success" size="action" disabled={submitting} onClick={() => void decideCorrection('Disetujui')}>
                      <Check aria-hidden="true" />
                      {submitting ? 'Menyimpan...' : 'Setujui koreksi'}
                    </Button>
                  </>
                )}
              </DialogFooter>
            )}
          </>
        )}
      </Dialog>
    </div>
  )
}
