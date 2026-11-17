'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { mockDepartments } from '@/lib/mock/master-data'
import {
  requestStatuses,
  requestTypes,
  type ApprovalRequest,
  type RequestStatus,
  type RequestType,
} from '@/lib/mock/requests'
import { formatTanggal } from '@/lib/format'
import { decideRequest, listRequests } from '@/lib/services/request-service'

const adminName = 'Rina Kartika (HRD)'

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
  const [typeFilter, setTypeFilter] = useState<RequestType | 'Semua'>('Semua')
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'Semua'>('Menunggu persetujuan')
  const [departmentFilter, setDepartmentFilter] = useState('Semua')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          (typeFilter === 'Semua' || request.type === typeFilter) &&
          (statusFilter === 'Semua' || request.status === statusFilter) &&
          (departmentFilter === 'Semua' || request.department === departmentFilter),
      ),
    [departmentFilter, requests, statusFilter, typeFilter],
  )
  const pendingCount = requests.filter((request) => request.status === 'Menunggu persetujuan').length

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      setRequests(await listRequests())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Data pengajuan gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openDetails(request: ApprovalRequest) {
    setSelected(request)
    setRejectMode(false)
    setRejectionReason('')
  }

  async function handleDecision(decision: 'Disetujui' | 'Ditolak') {
    if (!selected || submitting) return
    if (decision === 'Ditolak' && !rejectionReason.trim()) {
      toast.error('Alasan penolakan wajib diisi.')
      return
    }
    setSubmitting(true)
    try {
      const updated = await decideRequest(selected.id, decision, adminName, rejectionReason)
      setRequests((current) => current.map((request) => (request.id === updated.id ? updated : request)))
      setSelected(updated)
      setRejectMode(false)
      setRejectionReason('')
      toast.success(
        decision === 'Disetujui' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Status pengajuan gagal diperbarui.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoadingSkeleton label="antrian pengajuan" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <DemoDataNotice>
        Daftar pengajuan ini menggunakan data contoh. Perubahan keputusan tersimpan di browser ini.
      </DemoDataNotice>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Menunggu persetujuan"
          value={String(pendingCount)}
          hint="Jumlah permintaan yang belum diproses"
          icon={ClipboardCheck}
          tone="amber"
        />
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
              onChange={(event) => setTypeFilter(event.target.value as RequestType | 'Semua')}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <option value="Semua">Semua jenis</option>
              {requestTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="request-filter-status" className="text-sm font-semibold text-heading">Status</label>
            <select
              id="request-filter-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as RequestStatus | 'Semua')}
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
              {mockDepartments.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}
            </select>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <EmptyState
            title={requests.length === 0 ? 'Belum ada pengajuan' : 'Tidak ada pengajuan yang cocok'}
            description={
              requests.length === 0
                ? 'Pengajuan karyawan akan muncul di antrian ini.'
                : 'Ubah filter jenis, status, atau departemen untuk melihat pengajuan lain.'
            }
            icon={Inbox}
          />
        ) : (
          <>
            <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-border xl:block">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <caption className="sr-only">Antrian pengajuan karyawan</caption>
                <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3">Karyawan</th>
                    <th scope="col" className="px-4 py-3">Jenis</th>
                    <th scope="col" className="px-4 py-3">Tanggal</th>
                    <th scope="col" className="px-4 py-3">Departemen</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Detail</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="align-middle">
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
                        <Button type="button" variant="outline" size="action" onClick={() => openDetails(request)}>
                          Lihat detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border xl:hidden" aria-label="Daftar pengajuan karyawan">
              {filteredRequests.map((request) => (
                <li key={request.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
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
                    onChange={(event) => setRejectionReason(event.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  />
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
