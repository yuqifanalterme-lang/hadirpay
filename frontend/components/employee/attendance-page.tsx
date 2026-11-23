'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, Clock3, LogIn, LogOut, MapPin, MapPinCheck } from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Button } from '@/components/ui/button'
import { StatIcon } from '@/components/ui/stat-icon'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { Panel } from '@/components/hadirpay/panel'
import type { EmployeeAttendanceRecord } from '@/lib/mock/attendance'
import { formatTanggal } from '@/lib/format'
import { ApiError } from '@/lib/api/client'
import { config } from '@/lib/config'
import {
  formatAttendanceRadius,
  formatAttendanceTime,
  getCurrentAttendanceLocation,
  getAttendanceToday,
  getServerTime,
  getLocalDateKey,
  listAttendanceRecords,
  recordCheckIn,
  recordCheckOut,
  type AttendanceToday,
} from '@/lib/services/absensi.service'

const clockFormat = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  ...(config.mock.absensi ? {} : { timeZone: 'Asia/Jakarta' }),
})

type LocationState = 'Belum diperiksa' | 'Memeriksa lokasi' | 'Lokasi perangkat tersedia'
type AttendanceAction = 'Masuk' | 'Pulang'

function getTodayRecord(records: EmployeeAttendanceRecord[], date: Date) {
  const dateKey = getLocalDateKey(date)
  return records.find((record) => record.date === dateKey) ?? null
}

export function AttendancePage() {
  const [records, setRecords] = useState<EmployeeAttendanceRecord[]>([])
  const [todayData, setTodayData] = useState<AttendanceToday | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [locationState, setLocationState] = useState<LocationState>('Belum diperiksa')
  const [checkingLocation, setCheckingLocation] = useState(false)
  const [confirmAction, setConfirmAction] = useState<AttendanceAction | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      if (config.mock.absensi) {
        setTodayData(null)
        setRecords(await listAttendanceRecords())
        setNow(new Date())
      } else {
        const data = await getAttendanceToday()
        if (!data) throw new Error('Data absensi hari ini tidak tersedia.')
        setTodayData(data)
        setRecords(data.attendance ? [data.attendance] : [])
        setNow(getServerTime())
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Data absensi gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      setNow(config.mock.absensi ? new Date() : getServerTime())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function confirmAttendance() {
    if (!confirmAction || submitting) return
    setSubmitting(true)
    try {
      const currentTime = new Date()
      let record: EmployeeAttendanceRecord
      let recordedTime: string
      const location = config.mock.absensi ? undefined : await getCurrentAttendanceLocation()
      if (location) setLocationState('Lokasi perangkat tersedia')
      if (confirmAction === 'Masuk') {
        const checkedInRecord = await recordCheckIn(currentTime, location)
        record = checkedInRecord
        recordedTime = checkedInRecord.checkIn
      } else {
        const checkedOutRecord = await recordCheckOut(currentTime, location)
        record = checkedOutRecord
        recordedTime = checkedOutRecord.checkOut
      }
      await load()
      setConfirmAction(null)
      toast.success(`Absen ${confirmAction.toLowerCase()} berhasil dicatat.`, {
        description: `Pukul ${recordedTime}.`,
      })
    } catch (error) {
      const message = error instanceof ApiError && error.code === 'ALREADY_CHECKED_IN'
        ? 'Anda sudah melakukan absen masuk hari ini.'
        : error instanceof Error ? error.message : 'Absensi gagal disimpan.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  function checkLocation() {
    setCheckingLocation(true)
    setLocationState('Memeriksa lokasi')
    void getCurrentAttendanceLocation().then(() => {
      setCheckingLocation(false)
      setLocationState('Lokasi perangkat tersedia')
      toast.success('Lokasi perangkat tersedia.', {
        description: 'Lokasi perangkat akan dipakai untuk memvalidasi radius absensi.',
      })
    }).catch((error: unknown) => {
      setCheckingLocation(false)
      setLocationState('Belum diperiksa')
      toast.error(error instanceof Error ? error.message : 'Lokasi perangkat tidak dapat diperiksa.')
    })
  }

  if (loading) return <PageLoadingSkeleton label="absensi hari ini" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  const today = now ?? new Date()
  const todayRecord = getTodayRecord(records, today)
  const action: AttendanceAction | null = todayData
    ? todayData.canCheckIn
      ? 'Masuk'
      : todayData.canCheckOut
        ? 'Pulang'
        : null
    : !todayRecord
      ? 'Masuk'
      : todayRecord.checkIn && !todayRecord.checkOut
        ? 'Pulang'
        : null
  const currentTime = now ? clockFormat.format(now) : '--.--.--'
  const dateKey = todayData?.date ?? getLocalDateKey(today)
  const attendanceTime = config.mock.absensi
    ? { hour: today.getHours(), minute: today.getMinutes() }
    : Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(today).map((part) => [part.type, Number(part.value)])) as { hour: number; minute: number }
  const pastStartTime = config.mock.absensi && attendanceTime.hour * 60 + attendanceTime.minute > 8 * 60
  const isLate = todayRecord?.status === 'Terlambat' || (!todayRecord && pastStartTime)
  const workStart = todayData?.workHours.checkIn.replace(':', '.') ?? '08.00'
  const statusText = !todayRecord
    ? 'Belum ada catatan absensi hari ini. Pilih Absen Masuk untuk memulai.'
    : !todayRecord.checkIn
      ? `Status absensi hari ini: ${todayRecord.status}.`
    : todayRecord.checkOut
      ? `Absensi selesai. Masuk ${todayRecord.checkIn}, pulang ${todayRecord.checkOut}.`
      : `Sudah absen masuk pukul ${todayRecord.checkIn}.`

  return (
    <div className="flex flex-col gap-6">

      <section
        className="rounded-2xl bg-navy-2 p-5 text-white shadow-lg shadow-blue-900/20 sm:p-8"
        aria-labelledby="attendance-clock-heading"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <h2 id="attendance-clock-heading" className="text-sm font-semibold tracking-wide text-blue-100 uppercase">
              Absensi hari ini
            </h2>
            <p className="text-5xl font-extrabold tracking-tight tabular-nums sm:text-6xl" aria-live="off">
              {currentTime}
            </p>
            <p className="text-base text-blue-100 sm:text-lg">{formatTanggal(dateKey)}</p>
            <p className="flex items-center gap-2 text-sm text-blue-100">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              Radius area absensi: {formatAttendanceRadius(todayData?.office.radiusMeters ?? 5000)}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:w-80 lg:items-end">
            {todayRecord ? (
              <StatusBadge status={todayRecord.status} />
            ) : (
              <p className="text-sm font-semibold text-blue-100" role="status">
                Belum absen hari ini
              </p>
            )}
            {isLate && (
              <p className="text-sm font-semibold text-amber-200" role="status">
                {todayRecord
                  ? `Absen masuk setelah pukul ${workStart}`
                  : `Anda belum absen dan sudah melewati pukul ${workStart}`}
              </p>
            )}
            <Button
              type="button"
              variant={action === 'Pulang' ? 'outline' : 'success'}
              size="cta"
              className={action === 'Pulang' ? 'w-full border-white bg-white text-navy hover:bg-blue-50 lg:w-80' : 'w-full lg:w-80'}
              disabled={!action}
              onClick={() => action && setConfirmAction(action)}
            >
              {action === 'Pulang' ? (
                <LogOut aria-hidden="true" />
              ) : (
                <LogIn aria-hidden="true" />
              )}
              {action === 'Masuk'
                ? 'Absen Masuk'
                : action === 'Pulang'
                  ? 'Absen Pulang'
                  : todayRecord?.checkIn
                    ? 'Absen hari ini selesai'
                    : 'Tidak ada absensi hari ini'}
            </Button>
          </div>
        </div>
        {todayRecord?.status === 'Terlambat' && (
          <p className="mt-5 flex items-center gap-2 text-sm text-amber-200">
            <Clock3 className="size-4" aria-hidden="true" />
            Jam kerja dimulai pukul {workStart}. Waktu masuk tercatat {todayRecord.checkIn}.
          </p>
        )}
        {!todayRecord && pastStartTime && (
          <p className="mt-5 flex items-center gap-2 text-sm text-amber-200">
            <Clock3 className="size-4" aria-hidden="true" />
            Absen masuk setelah pukul {workStart} akan ditandai terlambat.
          </p>
        )}
        {todayRecord?.checkOut && (
          <p className="mt-5 flex items-center gap-2 text-sm text-blue-100">
            <CircleCheck className="size-4" aria-hidden="true" />
            {statusText}
          </p>
        )}
        {!todayRecord && <p className="sr-only">{statusText}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Jadwal kerja" description="Jam kerja reguler karyawan">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
            <StatIcon icon={Clock3} tone="primary" size="md" />
            <div>
              <p className="font-semibold text-heading">{todayData ? 'Jadwal kerja' : 'Senin sampai Jumat'}</p>
              <p className="text-sm text-muted-foreground">
                {todayData
                  ? `${todayData.workHours.checkIn.replace(':', '.')} sampai ${todayData.workHours.checkOut.replace(':', '.')}`
                  : '08.00 sampai 17.00'}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Status lokasi" description="Lokasi perangkat diperlukan untuk memvalidasi radius absensi">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <StatIcon
                icon={locationState === 'Lokasi perangkat tersedia' ? MapPinCheck : MapPin}
                tone="primary"
                size="md"
              />
              <div>
                <p className="font-semibold text-heading">{locationState}</p>
                <p className="text-sm text-muted-foreground">Izinkan akses lokasi saat mengirim absensi.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="action"
              onClick={checkLocation}
              disabled={checkingLocation}
            >
              {checkingLocation ? 'Memeriksa lokasi...' : 'Periksa lokasi'}
            </Button>
          </div>
        </Panel>
      </div>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setConfirmAction(null)
        }}
        label={`Konfirmasi absen ${confirmAction?.toLowerCase() ?? ''}`}
      >
        <DialogHeader
          title={`Konfirmasi absen ${confirmAction?.toLowerCase() ?? ''}`}
          description={
            confirmAction === 'Masuk'
              ? `Catat waktu masuk pukul ${now ? formatAttendanceTime(now) : 'sekarang'}? Lokasi perangkat akan diperiksa.`
              : `Catat waktu pulang pukul ${now ? formatAttendanceTime(now) : 'sekarang'}? Lokasi perangkat akan diperiksa.`
          }
          onClose={() => {
            if (!submitting) setConfirmAction(null)
          }}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="action"
            onClick={() => setConfirmAction(null)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button type="button" variant="primary" size="action" onClick={() => void confirmAttendance()} disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Konfirmasi absen'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
