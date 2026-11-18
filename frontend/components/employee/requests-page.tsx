'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { CalendarDays, FileText, Inbox, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Button } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { mockLeaveQuota, type ApprovalRequest, type RequestType } from '@/lib/mock/requests'
import { createRequest, listRequests } from '@/lib/services/request-service'
import { formatTanggal } from '@/lib/format'

const employeeId = 'HP-0001'
const employeeRequestTypes = ['Izin', 'Sakit', 'Cuti'] as const
type EmployeeRequestType = (typeof employeeRequestTypes)[number]
type RequestTab = 'Semua' | 'Izin' | 'Sakit' | 'Cuti' | 'Koreksi Absensi'

const tabs: RequestTab[] = ['Semua', 'Izin', 'Sakit', 'Cuti', 'Koreksi Absensi']

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
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [tab, setTab] = useState<RequestTab>('Semua')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [type, setType] = useState<EmployeeRequestType>('Izin')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const remainingLeave = mockLeaveQuota.annual - mockLeaveQuota.used
  const numberOfDays = useMemo(() => countWorkDays(startDate, endDate), [startDate, endDate])
  const visibleRequests = requests.filter(
    (request) =>
      request.employeeId === employeeId &&
      (tab === 'Semua' || request.type === (tab as RequestType)),
  )

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

  function resetForm() {
    setType('Izin')
    setStartDate('')
    setEndDate('')
    setReason('')
    setAttachmentName('')
    setFormError('')
  }

  function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setFormError('')
    if (!file) {
      setAttachmentName('')
      return
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) {
      setAttachmentName('')
      setFormError('Lampiran harus berupa PDF, JPG, atau PNG.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAttachmentName('')
      setFormError('Ukuran lampiran maksimal 5 MB.')
      event.target.value = ''
      return
    }
    setAttachmentName(file.name)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
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
        employeeId,
        name: 'Andi Wijaya',
        initials: 'AW',
        position: 'Staf Keuangan',
        department: 'Keuangan',
        type,
        startDate,
        endDate,
        days: numberOfDays,
        reason: reason.trim(),
        ...(attachmentName ? { attachmentName } : {}),
      })
      await load()
      setFormOpen(false)
      resetForm()
      toast.success('Pengajuan berhasil dikirim.')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Pengajuan gagal disimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoadingSkeleton label="daftar pengajuan" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <DemoDataNotice>
        Data pengajuan Andi Wijaya adalah data contoh. Perubahan tersimpan di browser ini.
      </DemoDataNotice>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Sisa kuota cuti tahunan"
          value={`${remainingLeave} hari`}
          hint={`Dari ${mockLeaveQuota.annual} hari, termasuk pengajuan yang sudah disetujui`}
          icon={CalendarDays}
          tone="violet"
        />
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
              onClick={() => setTab(item)}
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

        {visibleRequests.length === 0 ? (
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
          <ul className="divide-y divide-border" aria-live="polite">
            {visibleRequests.map((request) => (
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
                <p className="shrink-0 text-xs text-muted-foreground">Diajukan {formatTanggal(request.submittedAt)}</p>
              </li>
            ))}
          </ul>
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
                  onChange={(event) => setStartDate(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="request-end" className="text-sm font-semibold text-heading">Tanggal selesai</label>
                <input
                  id="request-end"
                  type="date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                />
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
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
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
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleAttachment}
                className="sr-only"
              />
              <p className="text-xs text-muted-foreground">
                PDF, JPG, atau PNG, maksimal 5 MB. Mode demo hanya menyimpan nama file, bukan isi lampiran.
              </p>
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
    </div>
  )
}
