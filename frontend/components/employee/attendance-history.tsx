'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck,
  CalendarDays,
  CircleX,
  Clock3,
  FileCheck2,
  HeartPulse,
} from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Panel } from '@/components/hadirpay/panel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { SelectField } from '@/components/ui/select-field'
import { StatCard } from '@/components/hadirpay/stat-card'
import type { AttendanceCorrection, EmployeeAttendanceRecord } from '@/lib/mock/attendance'
import { formatTanggal } from '@/lib/format'
import { config } from '@/lib/config'
import {
  getAttendanceHistory,
  getAttendanceToday,
  getLocalDateKey,
  submitAttendanceCorrection,
  type AttendanceHistoryPage,
} from '@/lib/services/absensi.service'

const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const statusDot: Record<EmployeeAttendanceRecord['status'], string> = {
  Hadir: 'bg-success',
  Terlambat: 'bg-warning',
  Izin: 'bg-info',
  Sakit: 'bg-info',
  Cuti: 'bg-leave',
  Alpha: 'bg-destructive',
  'Dinas Luar': 'bg-info',
}

type CorrectionField = 'Masuk' | 'Pulang'
type CorrectionForm = { field: CorrectionField; time: string; reason: string }

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}

function monthOptions(referencePeriod: string) {
  const [year, month] = referencePeriod.split('-').map(Number)
  const today = new Date(year, month - 1, 1)
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return { value, label: formatMonthLabel(value) }
  })
}

function getMonthDates(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const count = new Date(year, monthNumber, 0).getDate()
  const offset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`),
  ]
}

function getDuration(record: EmployeeAttendanceRecord) {
  if (!record.checkIn || !record.checkOut) return '-'
  const toMinutes = (time: string) => {
    const [hour, minute] = time.split('.').map(Number)
    return hour * 60 + minute
  }
  const minutes = toMinutes(record.checkOut) - toMinutes(record.checkIn)
  if (minutes <= 0) return '-'
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours} jam ${remainingMinutes} menit`
}

export function AttendanceHistory() {
  const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string }[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [history, setHistory] = useState<AttendanceHistoryPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [correctionRecord, setCorrectionRecord] = useState<EmployeeAttendanceRecord | null>(null)
  const [correction, setCorrection] = useState<CorrectionForm>({ field: 'Masuk', time: '', reason: '' })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CorrectionForm, string>>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      if (!selectedMonth) {
        const today = config.mock.absensi
          ? getLocalDateKey().slice(0, 7)
          : (await getAttendanceToday())?.date.slice(0, 7) ?? ''
        if (!today) throw new Error('Tanggal server untuk absensi belum tersedia.')
        const options = monthOptions(today)
        setAvailableMonths(options)
        setSelectedMonth(options[0].label)
        setPage(1)
        return
      }
      const period = availableMonths.find((option) => option.label === selectedMonth)?.value
      if (!period) throw new Error('Periode kehadiran tidak valid.')
      setHistory(await getAttendanceHistory(period, page, 20))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Riwayat kehadiran gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [availableMonths, selectedMonth, page, reload])

  const period = availableMonths.find((option) => option.label === selectedMonth)?.value ?? ''
  const monthRecords = history?.records ?? []
  const summary = history?.summary
  const calendar = history?.calendar ?? []
  const calendarByDate = useMemo(() => new Map(calendar.map((record) => [record.date, record.status])), [calendar])
  const dates = useMemo(() => period ? getMonthDates(period) : [], [period])
  const todayKey = getLocalDateKey()
  const totalPages = history?.meta?.total_pages ?? 1

  function openCorrection(record: EmployeeAttendanceRecord) {
    setCorrectionRecord(record)
    setCorrection({ field: 'Masuk', time: record.checkIn?.replace('.', ':') ?? '', reason: '' })
    setFormErrors({})
    setFormError('')
  }

  function updateCorrection<K extends keyof CorrectionForm>(key: K, value: CorrectionForm[K]) {
    setCorrection((current) => ({ ...current, [key]: value }))
    setFormErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function handleCorrectionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!correctionRecord || submitting) return
    const errors: Partial<Record<keyof CorrectionForm, string>> = {}
    if (!correction.time) errors.time = 'Jam yang benar wajib diisi.'
    if (!correction.reason.trim()) errors.reason = 'Alasan koreksi wajib diisi.'
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const request: Omit<AttendanceCorrection, 'id' | 'submittedAt' | 'status' | 'isMock'> = {
        date: correctionRecord.date,
        field: correction.field,
        correctedTime: correction.time.replace(':', '.'),
        reason: correction.reason.trim(),
      }
      await submitAttendanceCorrection(request)
      setReload((current) => current + 1)
      toast.success('Pengajuan koreksi berhasil disimpan.', {
        description: `Tanggal ${formatTanggal(correctionRecord.date)}.`,
      })
      setCorrectionRecord(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Pengajuan koreksi gagal disimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoadingSkeleton label="riwayat kehadiran" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => setReload((current) => current + 1)} />

  return (
    <div className="flex flex-col gap-6">

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Hadir" value={String(summary?.present ?? 0)} icon={CalendarCheck} tone="green" />
        <StatCard label="Terlambat" value={String(summary?.late ?? 0)} icon={Clock3} tone="amber" />
        <StatCard label="Izin" value={String(summary?.permission ?? 0)} icon={FileCheck2} tone="sky" />
        <StatCard label="Sakit" value={String(summary?.sick ?? 0)} icon={HeartPulse} tone="sky" />
        <StatCard label="Cuti" value={String(summary?.leave ?? 0)} icon={CalendarDays} tone="violet" />
        <StatCard label="Alpha" value={String(summary?.absent ?? 0)} icon={CircleX} tone="red" />
      </div>

      <Panel title="Kalender kehadiran" description="Warna penanda mengikuti status kehadiran.">
        <SelectField
          label="Bulan"
          value={selectedMonth}
          onChange={(label) => {
            if (availableMonths.some((option) => option.label === label)) {
              setSelectedMonth(label)
              setPage(1)
            }
          }}
          options={availableMonths.map((month) => month.label)}
          placeholder="Pilih bulan"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Keterangan status kalender">
          {(['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Cuti', 'Alpha', 'Dinas Luar'] as const).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="group" aria-label={`Kalender ${selectedMonth}`}>
          {weekdays.map((day) => (
            <div key={day} aria-hidden="true" className="py-1 text-center text-xs font-semibold text-muted-foreground">
              {day}
            </div>
          ))}
          {dates.map((date, index) => {
            if (!date) return <div key={`kosong-${index}`} aria-hidden="true" />
            const status = calendarByDate.get(date)
            const dayNumber = Number(date.slice(-2))
            const today = date === todayKey
            return (
              <div
                key={date}
                role="group"
                aria-label={`${formatTanggal(date)}${status ? `, ${status}` : ', belum ada catatan'}`}
                title={status ? `${dayNumber}: ${status}` : `${dayNumber}`}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-sm ${
                  today ? 'border-primary ring-2 ring-primary/15' : 'border-border'
                } ${status ? 'bg-white' : 'bg-surface'}`}
              >
                <span className="font-semibold text-heading">{dayNumber}</span>
                {status ? (
                  <span className={`size-2 rounded-full ${statusDot[status]}`} aria-hidden="true" />
                ) : (
                  <span className="size-2" aria-hidden="true" />
                )}
                {status && <span className="sr-only">{status}</span>}
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel title="Rincian kehadiran" description={`Catatan untuk ${selectedMonth}.`}>
        {(history?.meta?.total ?? monthRecords.length) === 0 ? (
          <EmptyState
            title={`Belum ada catatan untuk ${selectedMonth}`}
            description="Pilih bulan lain untuk melihat riwayat yang tersedia."
            icon={CalendarDays}
          />
        ) : (
          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Riwayat kehadiran Andi Wijaya</caption>
              <thead>
                <tr className="border-b border-border text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="py-3 pr-4">Tanggal</th>
                  <th scope="col" className="py-3 pr-4">Masuk</th>
                  <th scope="col" className="py-3 pr-4">Pulang</th>
                  <th scope="col" className="py-3 pr-4">Durasi</th>
                  <th scope="col" className="py-3 pr-4">Status</th>
                  <th scope="col" className="py-3">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {monthRecords.map((record) => (
                  <tr key={record.date} className="border-b border-border/70 last:border-0">
                    <td className="py-3 pr-4 font-medium capitalize text-heading">{formatTanggal(record.date)}</td>
                    <td className="py-3 pr-4 tabular-nums">{record.checkIn ?? '-'}</td>
                    <td className="py-3 pr-4 tabular-nums">{record.checkOut ?? '-'}</td>
                    <td className="py-3 pr-4">{getDuration(record)}</td>
                    <td className="py-3 pr-4"><StatusBadge status={record.status} /></td>
                    <td className="py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="action"
                        className="bg-white"
                        onClick={() => openCorrection(record)}
                        aria-label={`Ajukan koreksi untuk ${formatTanggal(record.date)}`}
                      >
                        Ajukan koreksi
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {history && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="action" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                Sebelumnya
              </Button>
              <Button type="button" variant="outline" size="action" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <Dialog
        open={correctionRecord !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setCorrectionRecord(null)
        }}
        label="Ajukan koreksi kehadiran"
        size="lg"
      >
        <form noValidate onSubmit={(event) => void handleCorrectionSubmit(event)}>
          <DialogHeader
            title="Ajukan koreksi kehadiran"
            description={
              correctionRecord
                ? `Untuk ${formatTanggal(correctionRecord.date)}. Pengajuan akan berstatus Menunggu.`
                : undefined
            }
            onClose={() => {
              if (!submitting) setCorrectionRecord(null)
            }}
          />
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="correction-date" className="text-sm font-semibold text-heading">Tanggal</label>
              <input
                id="correction-date"
                type="date"
                value={correctionRecord?.date ?? ''}
                readOnly
                className="min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-heading"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="correction-field" className="text-sm font-semibold text-heading">Waktu yang dikoreksi</label>
              <select
                id="correction-field"
                value={correction.field}
                onChange={(event) =>
                  updateCorrection('field', event.target.value === 'Pulang' ? 'Pulang' : 'Masuk')
                }
                className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <option value="Masuk">Jam masuk</option>
                <option value="Pulang">Jam pulang</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="correction-time" className="text-sm font-semibold text-heading">Jam yang benar</label>
              <input
                id="correction-time"
                type="time"
                value={correction.time}
                onChange={(event) => updateCorrection('time', event.target.value)}
                aria-invalid={Boolean(formErrors.time)}
                aria-describedby={formErrors.time ? 'correction-time-error' : undefined}
                className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
              {formErrors.time && <p id="correction-time-error" className="text-sm text-red-700" role="alert">{formErrors.time}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="correction-reason" className="text-sm font-semibold text-heading">Alasan koreksi</label>
              <textarea
                id="correction-reason"
                rows={3}
                value={correction.reason}
                onChange={(event) => updateCorrection('reason', event.target.value)}
                aria-invalid={Boolean(formErrors.reason)}
                aria-describedby={formErrors.reason ? 'correction-reason-error' : undefined}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
              {formErrors.reason && <p id="correction-reason-error" className="text-sm text-red-700" role="alert">{formErrors.reason}</p>}
            </div>
            {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="action"
              onClick={() => setCorrectionRecord(null)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" size="action" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Kirim koreksi'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
