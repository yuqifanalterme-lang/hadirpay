'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Eye, Inbox, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { TableActionIcon } from '@/components/ui/table-action-icon'
import {
  requestStatuses,
  requestTypes,
  type ApprovalRequest,
  type RequestStatus,
  type RequestType,
} from '@/lib/mock/requests'
import { formatTanggal } from '@/lib/format'
import { config } from '@/lib/config'
import type { MasterRecord } from '@/lib/mock/master-data'
import type { PengajuanListSummary } from '@/lib/types/pengajuan'
import { listMasterRecords } from '@/lib/services/karyawan.service'
import { bulkProcessRequests, decideRequest, getRequest, listRequestsPage } from '@/lib/services/pengajuan.service'
import { ApiError } from '@/lib/api/client'

const adminName = 'Rina Kartika (HRD)'
const pageSize = 10

function formatRequestDate(date: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function badgeStatus(request: ApprovalRequest) {
  return request.status
}

export function AdminRequestsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [selected, setSelected] = useState<ApprovalRequest | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<RequestType | 'Semua'>('Semua')
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'Semua'>('Menunggu persetujuan')
  const [departmentFilter, setDepartmentFilter] = useState('Semua')
  const [departments, setDepartments] = useState<MasterRecord[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<{ total: number; total_pages: number } | null>(null)
  const [summary, setSummary] = useState<PengajuanListSummary>({ menunggu: 0, disetujui: 0, ditolak: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionReasonError, setRejectionReasonError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const departmentData = departments.length ? departments : await listMasterRecords('departemen')
      const selectedDepartment = departmentData.find((item) => item.name === departmentFilter)
      const result = await listRequestsPage({
        type: typeFilter === 'Semua' ? undefined : typeFilter,
        status: statusFilter === 'Semua' ? undefined : statusFilter,
        departmentId: selectedDepartment?.id,
        departmentName: selectedDepartment?.name,
        search: debouncedSearch,
        dateFrom,
        dateTo,
        page,
        perPage: pageSize,
      })
      if (!departments.length) setDepartments(departmentData)
      if (page > Math.max(1, result.meta.total_pages)) {
        setPage(Math.max(1, result.meta.total_pages))
        return
      }
      setRequests(result.items)
      setMeta({ total: result.meta.total, total_pages: result.meta.total_pages })
      setSummary(result.summary)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Data pengajuan gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [typeFilter, statusFilter, departmentFilter, debouncedSearch, dateFrom, dateTo, page])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
      setSelectedIds([])
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  async function openDetails(request: ApprovalRequest) {
    setSelected(request)
    setRejectMode(false)
    setRejectionReason('')
    setRejectionReasonError('')
    setDetailLoading(true)
    try {
      setSelected(await getRequest(request.id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Detail pengajuan gagal dimuat.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleDecision(decision: 'Disetujui' | 'Ditolak') {
    if (!selected || submitting) return
    if (decision === 'Ditolak' && !rejectionReason.trim()) {
      toast.error('Alasan penolakan wajib diisi.')
      return
    }

    setSubmitting(true)
    setRejectionReasonError('')
    try {
      const updated = await decideRequest(selected.id, decision, adminName, rejectionReason)
      setSelected(updated)
      setRejectMode(false)
      setRejectionReason('')
      await load()
      toast.success(
        decision === 'Disetujui' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.',
      )
    } catch (error) {
      if (error instanceof ApiError && error.errors?.alasan_penolakan?.[0]) {
        setRejectionReasonError(error.errors.alasan_penolakan[0])
      }
      toast.error(error instanceof Error ? error.message : 'Status pengajuan gagal diperbarui.')
    } finally {
      setSubmitting(false)
    }
  }

  async function approveSelected() {
    if (!selectedIds.length || submitting) return
    const ids = selectedIds.map(Number)
    if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      toast.error('Pengajuan terpilih memiliki ID yang tidak valid untuk proses massal.')
      return
    }
    setSubmitting(true)
    try {
      const result = await bulkProcessRequests({ ids, aksi: 'setujui' })
      setSelectedIds([])
      await load()
      if (result.gagal.length) {
        toast.error(`${result.berhasil.length} pengajuan disetujui, ${result.gagal.length} gagal.`)
      } else {
        toast.success(`${result.berhasil.length} pengajuan berhasil disetujui.`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Pengajuan gagal diproses.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoadingSkeleton label="antrian pengajuan" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Menunggu persetujuan"
          value={String(summary.menunggu)}
          hint="Jumlah permintaan yang belum diproses"
          icon={ClipboardCheck}
          tone="amber"
        />
        <StatCard label="Disetujui" value={String(summary.disetujui)} icon={CheckCircle2} tone="green" />
        <StatCard label="Ditolak" value={String(summary.ditolak)} icon={XCircle} tone="amber" />
      </div>
      <Panel
        title="Antrian persetujuan"
        description="Tinjau detail pengajuan sebelum mengambil keputusan."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="request-filter-type" className="text-sm font-semibold text-heading">Jenis</label>
            <select
              id="request-filter-type"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as RequestType | 'Semua')
                setPage(1)
                setSelectedIds([])
              }}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <option value="Semua">Semua jenis</option>
              {requestTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          {!config.mock.pengajuan && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-3">
              <p className="text-sm text-muted-foreground">{selectedIds.length} pengajuan dipilih</p>
              <Button type="button" variant="success" size="action" disabled={submitting} onClick={() => void approveSelected()}>
                {submitting ? 'Memproses…' : 'Setujui terpilih'}
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor="request-filter-status" className="text-sm font-semibold text-heading">Status</label>
            <select
              id="request-filter-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as RequestStatus | 'Semua')
                setPage(1)
                setSelectedIds([])
              }}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <option value="Semua">Semua status</option>
              {requestStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="request-filter-department" className="text-sm font-semibold text-heading">Departemen</label>
            <select
              id="request-filter-department"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <option value="Semua">Semua departemen</option>
              {departments.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="request-filter-search" className="text-sm font-semibold text-heading">Cari pengajuan</label>
            <input
              id="request-filter-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="request-filter-date-from" className="text-sm font-semibold text-heading">Tanggal dari</label>
            <input
              id="request-filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value)
                setPage(1)
                setSelectedIds([])
              }}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="request-filter-date-to" className="text-sm font-semibold text-heading">Tanggal sampai</label>
            <input
              id="request-filter-date-to"
              type="date"
              min={dateFrom || undefined}
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPage(1)
                setSelectedIds([])
              }}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </div>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            title={meta?.total === 0 ? 'Belum ada pengajuan' : 'Tidak ada pengajuan yang cocok'}
            description={
              meta?.total === 0
                ? 'Pengajuan karyawan akan muncul di antrian ini.'
                : 'Ubah filter jenis, status, atau departemen untuk melihat pengajuan lain.'
            }
            icon={Inbox}
          />
        ) : (
          <>
            <div className="no-scrollbar hidden min-w-0 overflow-x-auto rounded-xl border border-border xl:block">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <caption className="sr-only">Antrian pengajuan karyawan</caption>
                <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    {!config.mock.pengajuan && <th scope="col" className="px-4 py-3"><span className="sr-only">Pilih</span></th>}
                    <th scope="col" className="px-4 py-3">Karyawan</th>
                    <th scope="col" className="px-4 py-3">Jenis</th>
                    <th scope="col" className="px-4 py-3">Tanggal</th>
                    <th scope="col" className="px-4 py-3">Departemen</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Detail</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((request) => (
                    <tr key={request.id} className="align-middle">
                      {!config.mock.pengajuan && <td className="px-4 py-3">
                        {request.status === 'Menunggu persetujuan' && (
                          <input
                            type="checkbox"
                            aria-label={`Pilih pengajuan ${request.name}`}
                            checked={selectedIds.includes(request.id)}
                            onChange={(event) => setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, request.id]
                                : current.filter((id) => id !== request.id),
                            )}
                            className="size-4 accent-primary"
                          />
                        )}
                      </td>}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar initials={request.initials} tone="outlined" />
                          <div>
                            <p className="font-semibold text-heading">{request.name}</p>
                            <p className="text-xs text-muted-foreground">{request.position}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{request.type}</td>
                      <td className="px-4 py-3">
                        {formatRequestDate(request.startDate)}
                        {request.endDate !== request.startDate ? ` sampai ${formatRequestDate(request.endDate)}` : ''}
                      </td>
                      <td className="px-4 py-3">{request.department}</td>
                      <td className="px-4 py-3"><StatusBadge status={badgeStatus(request)} /></td>
                      <td className="px-4 py-3 text-right">
                        <TableActionIcon
                          label="Detail"
                          ariaLabel={`Detail ${request.name}`}
                          icon={Eye}
                          tone="blue"
                          onClick={() => openDetails(request)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border xl:hidden" aria-label="Daftar pengajuan karyawan">
              {requests.map((request) => (
                <li key={request.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  {!config.mock.pengajuan && request.status === 'Menunggu persetujuan' && (
                    <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(request.id)}
                        onChange={(event) => setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, request.id]
                            : current.filter((id) => id !== request.id),
                        )}
                        className="size-4 accent-primary"
                      />
                      Pilih pengajuan
                    </label>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar initials={request.initials} tone="outlined" />
                      <div className="min-w-0">
                        <p className="font-semibold text-heading">{request.name}</p>
                        <p className="text-sm text-muted-foreground">{request.position} · {request.department}</p>
                      </div>
                    </div>
                    <StatusBadge status={badgeStatus(request)} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground">
                    <span>{request.type}</span>
                    <span>{formatRequestDate(request.startDate)}{request.endDate !== request.startDate ? ` sampai ${formatRequestDate(request.endDate)}` : ''}</span>
                    <span>{request.days} hari</span>
                  </div>
                  <Button type="button" variant="outline" size="action" onClick={() => openDetails(request)} className="self-start">
                    Lihat detail
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Menampilkan {meta?.total ? (page - 1) * pageSize + 1 : 0} sampai {Math.min(page * pageSize, meta?.total ?? 0)} dari {meta?.total ?? 0} pengajuan.
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="action" className="bg-white" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Sebelumnya
                </Button>
                <span className="min-w-20 text-center text-sm text-muted-foreground">
                  Halaman {page} dari {Math.max(1, meta?.total_pages ?? 1)}
                </span>
                <Button type="button" variant="outline" size="action" className="bg-white" disabled={page >= (meta?.total_pages ?? 1)} onClick={() => setPage((current) => Math.min(meta?.total_pages ?? 1, current + 1))}>
                  Berikutnya
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setRejectMode(false)
            setRejectionReason('')
          }
        }}
        label="Detail pengajuan karyawan"
        size="lg"
      >
        {selected && (
          <>
            <DialogHeader
              title={`Pengajuan ${selected.type.toLowerCase()}`}
              description={`${selected.name} · ${selected.department}`}
              onClose={() => setSelected(null)}
            />
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              {detailLoading && <p className="text-sm text-muted-foreground" role="status">Memuat detail pengajuan…</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar initials={selected.initials} size="lg" tone="outlined" />
                  <div>
                    <p className="font-semibold text-heading">{selected.name}</p>
                    <p className="text-sm text-muted-foreground">{selected.position}</p>
                  </div>
                </div>
                <StatusBadge status={badgeStatus(selected)} />
              </div>
              <dl className="grid gap-4 rounded-xl bg-surface p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Tanggal</dt>
                  <dd className="mt-1 text-sm text-heading">
                    {formatRequestDate(selected.startDate)}
                    {selected.endDate !== selected.startDate ? ` sampai ${formatRequestDate(selected.endDate)}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Jumlah hari</dt>
                  <dd className="mt-1 text-sm text-heading">{selected.days} hari kerja</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">Diajukan</dt>
                  <dd className="mt-1 text-sm text-heading">{formatTanggal(selected.submittedAt)}</dd>
                </div>
                {selected.approvedBy && (
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">
                      {selected.status === 'Disetujui' ? 'Disetujui oleh' : 'Diproses oleh'}
                    </dt>
                    <dd className="mt-1 text-sm text-heading">{selected.approvedBy}</dd>
                  </div>
                )}
              </dl>
              <div>
                <h3 className="text-sm font-semibold text-heading">Alasan</h3>
                <p className="mt-1 text-sm text-foreground">{selected.reason}</p>
              </div>
              {selected.attachmentName && (
                <div>
                  <h3 className="text-sm font-semibold text-heading">Lampiran</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{selected.attachmentName}</p>
                </div>
              )}
              {selected.rejectionReason && (
                <p className="text-sm text-destructive">Alasan penolakan: {selected.rejectionReason}</p>
              )}
              {selected.status === 'Menunggu persetujuan' && rejectMode && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="request-rejection-reason" className="text-sm font-semibold text-heading">
                    Alasan penolakan
                  </label>
                  <textarea
                    id="request-rejection-reason"
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(event) => {
                      setRejectionReason(event.target.value)
                      setRejectionReasonError('')
                    }}
                    aria-invalid={Boolean(rejectionReasonError)}
                    aria-describedby={rejectionReasonError ? 'request-rejection-error' : undefined}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  />
                  {rejectionReasonError && <p id="request-rejection-error" className="text-sm font-medium text-destructive" role="alert">{rejectionReasonError}</p>}
                </div>
              )}
            </div>
            {selected.status === 'Menunggu persetujuan' && (
              <DialogFooter>
                {rejectMode ? (
                  <>
                    <Button type="button" variant="outline" size="action" onClick={() => setRejectMode(false)}>
                      Batal
                    </Button>
                    <Button
                      type="button"
                      variant="dangerOutline"
                      size="action"
                      disabled={submitting || !rejectionReason.trim()}
                      onClick={() => void handleDecision('Ditolak')}
                    >
                      {submitting ? 'Menyimpan...' : 'Konfirmasi penolakan'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="dangerOutline" size="action" onClick={() => setRejectMode(true)}>
                      Tolak
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      size="action"
                      disabled={submitting}
                      onClick={() => void handleDecision('Disetujui')}
                    >
                      {submitting ? 'Menyimpan...' : 'Setujui'}
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
