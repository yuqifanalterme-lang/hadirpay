'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { CalendarDays, CheckCircle2, ClipboardCheck, FileText, Inbox, Plus, Upload, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { requestStatuses, type ApprovalRequest, type RequestStatus, type RequestType } from '@/lib/mock/requests'
import type { PengajuanListSummary } from '@/lib/types/pengajuan'
import { cancelRequest, createRequest, getLeaveQuota, listRequestsPage } from '@/lib/services/pengajuan.service'
import { formatTanggal } from '@/lib/format'
import { config } from '@/lib/config'
import { useAuth } from '@/lib/auth/auth-provider'
import { ApiError, type ApiErrorFields } from '@/lib/api/client'

const employeeId = 'HP-0002'
const employeeRequestTypes = ['Izin', 'Sakit', 'Cuti'] as const
type EmployeeRequestType = (typeof employeeRequestTypes)[number]
type RequestTab = 'Semua' | 'Izin' | 'Sakit' | 'Cuti' | 'Koreksi Absensi'

const tabs: RequestTab[] = ['Semua', 'Izin', 'Sakit', 'Cuti', 'Koreksi Absensi']
const pageSize = 10

function countWorkDays(start: string, end: string) {
  if (!start || !end) return 0
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const [endYear, endMonth, endDay] = end.split('-').map(Number)
  const cursor = new Date(startYear, startMonth - 1, startDay)
  const last = new Date(endYear, endMonth - 1, endDay)
  if (last.getTime() - cursor.getTime() > 366 * 86400000) return 0
  let count = 0
  while (cursor <= last) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

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

export function RequestsPage() {
  const { user, loading: authLoading } = useAuth()
  const currentEmployeeId = config.mock.auth ? employeeId : String(user?.karyawan_id ?? '')
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [quota, setQuota] = useState<Awaited<ReturnType<typeof getLeaveQuota>> | null>(null)
  const [tab, setTab] = useState<RequestTab>('Semua')
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'Semua'>('Semua')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<{ total: number; total_pages: number } | null>(null)
  const [summary, setSummary] = useState<PengajuanListSummary>({ menunggu: 0, disetujui: 0, ditolak: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [type, setType] = useState<EmployeeRequestType>('Izin')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ApiErrorFields>({})
  const [submitting, setSubmitting] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<ApprovalRequest | null>(null)
  const [cancelSaving, setCancelSaving] = useState(false)

  const remainingLeave = quota?.cuti_sisa ?? 0
  const numberOfDays = useMemo(
    () => countWorkDays(startDate, endDate),
    [endDate, startDate, type],
  )
  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      if (!currentEmployeeId) throw new Error('Akun karyawan belum terhubung ke data karyawan.')
      const [requestPage, nextQuota] = await Promise.all([
        listRequestsPage({
          type: tab === 'Semua' ? undefined : tab as RequestType,
          status: statusFilter === 'Semua' ? undefined : statusFilter,
          employeeId: currentEmployeeId,
          search: debouncedSearch,
          dateFrom,
          dateTo,
          page,
          perPage: pageSize,
        }),
        getLeaveQuota(),
      ])
      setQuota(nextQuota)
      if (page > Math.max(1, requestPage.meta.total_pages)) {
        setPage(Math.max(1, requestPage.meta.total_pages))
        return
      }
      setRequests(requestPage.items)
      setMeta({ total: requestPage.meta.total, total_pages: requestPage.meta.total_pages })
      setSummary(requestPage.summary)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Data pengajuan gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, currentEmployeeId, tab, statusFilter, debouncedSearch, dateFrom, dateTo, page])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  function resetForm() {
    setType('Izin')
    setStartDate('')
    setEndDate('')
    setReason('')
    setAttachmentName('')
    setAttachmentFile(null)
    setFormError('')
    setFieldErrors({})
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => ({ ...current, [field]: [] }))
  }

  function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setFormError('')
    clearFieldError('lampiran')
    if (!file) {
      setAttachmentName('')
      setAttachmentFile(null)
      return
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) {
      setAttachmentName('')
      setAttachmentFile(null)
      setFormError('Lampiran harus berupa PDF, JPG, atau PNG.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAttachmentName('')
      setAttachmentFile(null)
      setFormError('Ukuran lampiran maksimal 5 MB.')
      event.target.value = ''
      return
    }
    setAttachmentName(file.name)
    setAttachmentFile(file)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setFieldErrors({})
    if (!startDate || !endDate) {
      setFormError('Tanggal mulai dan selesai wajib diisi.')
      return
    }
    if (endDate < startDate) {
      setFormError('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }
    if (numberOfDays === 0) {
      setFormError('Pilih setidaknya satu hari kerja untuk pengajuan.')
      return
    }
    if (endDate > startDate && new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime() > 366 * 86400000) {
      setFormError('Rentang pengajuan tidak boleh lebih dari satu tahun.')
      return
    }
    if (!reason.trim()) {
      setFormError('Alasan pengajuan wajib diisi.')
      return
    }
    if (type === 'Sakit' && !attachmentName) {
      setFormError('Lampirkan surat dokter untuk pengajuan sakit.')
      return
    }
    if (type === 'Cuti' && numberOfDays > remainingLeave) {
      setFormError(`Sisa kuota cuti Anda ${remainingLeave} hari.`)
      return
    }
    setSubmitting(true)
    try {
      await createRequest({
        employeeId: currentEmployeeId,
        name: user?.nama ?? 'Andi Wijaya',
        initials: user?.inisial ?? 'AW',
        position: user?.jabatan ?? 'Staf Keuangan',
        department: 'Keuangan',
        type,
        startDate,
        endDate,
        days: numberOfDays,
        reason: reason.trim(),
        ...(attachmentName ? { attachmentName } : {}),
        ...(attachmentFile ? { attachment: attachmentFile } : {}),
      })
      await load()
      setFormOpen(false)
      resetForm()
      toast.success('Pengajuan berhasil dikirim.')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Pengajuan gagal disimpan.')
      if (error instanceof ApiError && error.errors) setFieldErrors(error.errors)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancelRequest() {
    if (!cancelTarget || cancelSaving) return
    setCancelSaving(true)
    try {
      await cancelRequest(cancelTarget.id)
      setCancelTarget(null)
      await load()
      toast.success('Pengajuan berhasil dibatalkan.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Pengajuan gagal dibatalkan.')
    } finally {
      setCancelSaving(false)
    }
  }

  if (loading) return <PageLoadingSkeleton label="daftar pengajuan" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sisa kuota cuti tahunan"
          value={`${remainingLeave} hari`}
          hint={`Dari ${quota?.cuti_tahunan_total ?? 0} hari, termasuk pengajuan yang sudah disetujui`}
          icon={CalendarDays}
          tone="violet"
        />
        <StatCard label="Menunggu persetujuan" value={String(summary.menunggu)} icon={ClipboardCheck} tone="amber" />
        <StatCard label="Disetujui" value={String(summary.disetujui)} icon={CheckCircle2} tone="green" />
        <StatCard label="Ditolak" value={String(summary.ditolak)} icon={XCircle} tone="amber" />
      </div>
      <Panel
        title="Pengajuan saya"
        description="Pantau izin, sakit, cuti, dan koreksi absensi."
        action={
          <Button type="button" variant="primary" size="action" onClick={() => setFormOpen(true)}>
            <Plus aria-hidden="true" />
            Buat pengajuan
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Filter jenis pengajuan">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={tab === item}
              onClick={() => {
                setTab(item)
                setPage(1)
              }}
              className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                tab === item
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-foreground hover:bg-surface'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="employee-request-search" className="text-sm font-semibold text-heading">Cari pengajuan</label>
            <input
              id="employee-request-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="employee-request-status" className="text-sm font-semibold text-heading">Status</label>
            <select
              id="employee-request-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as RequestStatus | 'Semua')
                setPage(1)
              }}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <option value="Semua">Semua status</option>
              {requestStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="employee-request-date-from" className="text-sm font-semibold text-heading">Tanggal dari</label>
            <input
              id="employee-request-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value)
                setPage(1)
              }}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="employee-request-date-to" className="text-sm font-semibold text-heading">Tanggal sampai</label>
            <input
              id="employee-request-date-to"
              type="date"
              min={dateFrom || undefined}
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPage(1)
              }}
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            />
          </div>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            title={tab === 'Semua' ? 'Belum ada pengajuan' : `Belum ada pengajuan ${tab.toLowerCase()}`}
            description="Pengajuan yang Anda buat akan muncul di sini."
            icon={Inbox}
            action={
              <Button type="button" variant="outline" size="action" onClick={() => setFormOpen(true)}>
                Buat pengajuan
              </Button>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border" aria-live="polite">
              {requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-heading">{request.type}</h3>
                    <StatusBadge status={badgeStatus(request)} />
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    {formatRequestDate(request.startDate)}
                    {request.endDate !== request.startDate ? ` sampai ${formatRequestDate(request.endDate)}` : ''}
                    {' · '}{request.days} hari kerja
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{request.reason}</p>
                  {request.attachmentName && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <FileText className="size-4" aria-hidden="true" />
                      {request.attachmentName}
                    </p>
                  )}
                  {request.approvedBy && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {request.status === 'Disetujui' ? 'Disetujui oleh' : 'Diproses oleh'} {request.approvedBy}
                    </p>
                  )}
                  {request.rejectionReason && (
                    <p className="mt-2 text-sm text-destructive">Alasan penolakan: {request.rejectionReason}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <p className="text-xs text-muted-foreground">Diajukan {formatTanggal(request.submittedAt)}</p>
                  {request.status === 'Menunggu persetujuan' && !request.id.startsWith('koreksi-') && (
                    <Button type="button" variant="outline" size="action" onClick={() => setCancelTarget(request)}>
                      Batalkan pengajuan
                    </Button>
                  )}
                </div>
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
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) resetForm()
        }}
        label="Form buat pengajuan"
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader
            title="Buat pengajuan"
            description="Isi detail pengajuan untuk diteruskan ke HRD."
            onClose={() => setFormOpen(false)}
          />
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="request-type" className="text-sm font-semibold text-heading">Jenis pengajuan</label>
              <select
                id="request-type"
                value={type}
                onChange={(event) => {
                  setType(event.target.value as EmployeeRequestType)
                  setFormError('')
                  setFieldErrors({})
                  setAttachmentName('')
                  setAttachmentFile(null)
                }}
                className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                {employeeRequestTypes.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            {type === 'Cuti' && (
              <p className="rounded-xl bg-surface px-4 py-3 text-sm text-foreground">
                Sisa kuota cuti: <strong className="text-heading">{remainingLeave} hari</strong>.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="request-start" className="text-sm font-semibold text-heading">Tanggal mulai</label>
                <input
                  id="request-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value)
                    clearFieldError('tanggal_mulai')
                  }}
                  aria-invalid={Boolean(fieldErrors.tanggal_mulai?.length)}
                  aria-describedby={fieldErrors.tanggal_mulai?.length ? 'request-start-error' : undefined}
                  className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                />
                {fieldErrors.tanggal_mulai?.[0] && <p id="request-start-error" className="text-sm font-medium text-destructive" role="alert">{fieldErrors.tanggal_mulai[0]}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="request-end" className="text-sm font-semibold text-heading">Tanggal selesai</label>
                <input
                  id="request-end"
                  type="date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value)
                    clearFieldError('tanggal_selesai')
                  }}
                  aria-invalid={Boolean(fieldErrors.tanggal_selesai?.length)}
                  aria-describedby={fieldErrors.tanggal_selesai?.length ? 'request-end-error' : undefined}
                  className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                />
                {fieldErrors.tanggal_selesai?.[0] && <p id="request-end-error" className="text-sm font-medium text-destructive" role="alert">{fieldErrors.tanggal_selesai[0]}</p>}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Jumlah hari kerja: <strong className="text-heading">{numberOfDays} hari</strong> (tidak termasuk akhir pekan).
            </p>

            <div className="flex flex-col gap-2">
              <label htmlFor="request-reason" className="text-sm font-semibold text-heading">Alasan</label>
              <textarea
                id="request-reason"
                required
                rows={3}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value)
                  clearFieldError('alasan')
                }}
                aria-invalid={Boolean(fieldErrors.alasan?.length)}
                aria-describedby={fieldErrors.alasan?.length ? 'request-reason-error' : undefined}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
              {fieldErrors.alasan?.[0] && <p id="request-reason-error" className="text-sm font-medium text-destructive" role="alert">{fieldErrors.alasan[0]}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="request-attachment" className="text-sm font-semibold text-heading">
                Lampiran {type === 'Sakit' ? '(wajib)' : '(opsional)'}
              </label>
              <label
                htmlFor="request-attachment"
                className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-surface"
              >
                <Upload className="size-4" aria-hidden="true" />
                {attachmentName || 'Pilih surat dokter atau dokumen'}
              </label>
              <input
                id="request-attachment"
                key={type}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleAttachment}
                className="sr-only"
              />
              <p className="text-xs text-muted-foreground">
                PDF, JPG, atau PNG, maksimal 5 MB. Berkas akan dikirim bersama pengajuan.
              </p>
              {fieldErrors.lampiran?.[0] && <p className="text-sm font-medium text-destructive" role="alert">{fieldErrors.lampiran[0]}</p>}
            </div>
            {formError && <p className="text-sm font-medium text-destructive" role="alert">{formError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="action" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="action" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Kirim pengajuan'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancelSaving) setCancelTarget(null)
        }}
        label="Batalkan pengajuan"
      >
        {cancelTarget && (
          <form onSubmit={(event) => { event.preventDefault(); void handleCancelRequest() }}>
            <DialogHeader
              title="Batalkan pengajuan"
              description={`${cancelTarget.type} · ${formatRequestDate(cancelTarget.startDate)}`}
              onClose={() => setCancelTarget(null)}
            />
            <DialogFooter>
              <Button type="button" variant="outline" size="action" disabled={cancelSaving} onClick={() => setCancelTarget(null)}>
                Kembali
              </Button>
              <Button type="submit" variant="dangerOutline" size="action" disabled={cancelSaving}>
                {cancelSaving ? 'Membatalkan…' : 'Batalkan pengajuan'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </div>
  )
}
