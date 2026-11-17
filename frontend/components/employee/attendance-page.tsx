'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, Clock3, LogIn, LogOut, MapPin, MapPinCheck } from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Button } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { Panel } from '@/components/hadirpay/panel'
import type { EmployeeAttendanceRecord } from '@/lib/mock/attendance'
import { formatTanggal } from '@/lib/format'
import {
  formatAttendanceTime,
  getLocalDateKey,
  listAttendanceRecords,
  recordCheckIn,
  recordCheckOut,
} from '@/lib/services/attendance-service'

const clockFormat = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

type LocationState = 'Belum diperiksa' | 'Memeriksa lokasi' | 'Lokasi perangkat tersedia'
type AttendanceAction = 'Masuk' | 'Pulang'

function getTodayRecord(records: EmployeeAttendanceRecord[], date: Date) {
  const dateKey = getLocalDateKey(date)
  return records.find((record) => record.date === dateKey) ?? null
}

export function AttendancePage() {
  const [records, setRecords] = useState<EmployeeAttendanceRecord[]>([])
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
      setRecords(await listAttendanceRecords())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Data absensi gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function confirmAttendance() {
    if (!confirmAction || submitting) return
    setSubmitting(true)
    try {
      const currentTime = new Date()
      let record: EmployeeAttendanceRecord
      let recordedTime: string
      if (confirmAction === 'Masuk') {
        const checkedInRecord = await recordCheckIn(currentTime)
        record = checkedInRecord
        recordedTime = checkedInRecord.checkIn
      } else {
        const checkedOutRecord = await recordCheckOut(currentTime)
        record = checkedOutRecord
        recordedTime = checkedOutRecord.checkOut
      }
      setRecords((current) => [record, ...current.filter((item) => item.date !== record.date)])
      setConfirmAction(null)
      toast.success(`Absen ${confirmAction.toLowerCase()} berhasil dicatat.`, {
        description: `Pukul ${recordedTime}.`,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Absensi gagal disimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  function checkLocation() {
    if (!navigator.geolocation) {
      toast.error('Perangkat ini tidak menyediakan pemeriksaan lokasi.')
      return
    }
    setCheckingLocation(true)
    setLocationState('Memeriksa lokasi')
    navigator.geolocation.getCurrentPosition(
      () => {
        setCheckingLocation(false)
        setLocationState('Lokasi perangkat tersedia')
        toast.success('Lokasi perangkat tersedia.', {
          description: 'Pemeriksaan lokasi bersifat opsional dan tidak menentukan keberhasilan absen.',
        })
      },
      (error) => {
        setCheckingLocation(false)
        setLocationState('Belum diperiksa')
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Izin lokasi tidak diberikan.', {
            description: 'Anda tetap dapat melakukan absensi tanpa mengaktifkan lokasi.',
          })
          return
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error('Lokasi perangkat tidak tersedia saat ini.')
          return
        }
        toast.error('Pemeriksaan lokasi melewati batas waktu. Coba lagi atau lanjutkan tanpa lokasi.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  if (loading) return <PageLoadingSkeleton label="absensi hari ini" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  const today = now ?? new Date()
  const todayRecord = getTodayRecord(records, today)
  const action: AttendanceAction | null = !todayRecord
    ? 'Masuk'
    : todayRecord.checkIn && !todayRecord.checkOut
      ? 'Pulang'
      : null
  const currentTime = now ? clockFormat.format(now) : '--.--.--'
  const dateKey = getLocalDateKey(today)
  const pastStartTime = today.getHours() * 60 + today.getMinutes() > 8 * 60
  const isLate = todayRecord?.status === 'Terlambat' || (!todayRecord && pastStartTime)
  const statusText = !todayRecord
    ? 'Belum ada catatan absensi hari ini. Pilih Absen Masuk untuk memulai.'
    : !todayRecord.checkIn
      ? `Status absensi hari ini: ${todayRecord.status}.`
    : todayRecord.checkOut
      ? `Absensi selesai. Masuk ${todayRecord.checkIn}, pulang ${todayRecord.checkOut}.`
      : `Sudah absen masuk pukul ${todayRecord.checkIn}.`

  return (
    <div className="flex flex-col gap-6">
      <DemoDataNotice>
        Data absensi Andi Wijaya untuk mode demo. Catatan dan perubahan tersimpan di browser ini saja.
      </DemoDataNotice>

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
              Kantor Pusat, Jl. Sudirman No. 21, Jakarta
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
                  ? 'Absen masuk setelah pukul 08.00'
                  : 'Anda belum absen dan sudah melewati pukul 08.00'}
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
            Jam kerja dimulai pukul 08.00. Waktu masuk tercatat {todayRecord.checkIn}.
          </p>
        )}
        {!todayRecord && pastStartTime && (
          <p className="mt-5 flex items-center gap-2 text-sm text-amber-200">
            <Clock3 className="size-4" aria-hidden="true" />
            Absen masuk setelah pukul 08.00 akan ditandai terlambat.
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
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary">
              <Clock3 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-heading">Senin sampai Jumat</p>
              <p className="text-sm text-muted-foreground">08.00 sampai 17.00</p>
            </div>
          </div>
        </Panel>

        <Panel title="Status lokasi" description="Pemeriksaan lokasi bersifat opsional">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary">
                {locationState === 'Lokasi perangkat tersedia' ? (
                  <MapPinCheck className="size-5" aria-hidden="true" />
                ) : (
                  <MapPin className="size-5" aria-hidden="true" />
                )}
              </span>
              <div>
                <p className="font-semibold text-heading">{locationState}</p>
                <p className="text-sm text-muted-foreground">Absensi tetap dapat dilakukan tanpa lokasi.</p>
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
              ? `Catat waktu masuk pukul ${now ? formatAttendanceTime(now) : 'sekarang'}?`
              : `Catat waktu pulang pukul ${now ? formatAttendanceTime(now) : 'sekarang'}?`
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
