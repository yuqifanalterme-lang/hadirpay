'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, LogIn, LogOut, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { WeekChips } from '@/components/hadirpay/week-chips'
import type { WeekDay } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

type Phase = 'belum' | 'masuk' | 'selesai'

const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const shortTime = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d)

export function AttendanceClock() {
  const [now, setNow] = useState<Date | null>(null)
  const [phase, setPhase] = useState<Phase>('belum')
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  function handleAbsen() {
    const t = shortTime(new Date())
    if (phase === 'belum') {
      setCheckIn(t)
      setPhase('masuk')
      toast.success('Absen berhasil dicatat', { description: `Absen masuk pukul ${t}` })
    } else if (phase === 'masuk') {
      setCheckOut(t)
      setPhase('selesai')
      toast.success('Absen berhasil dicatat', { description: `Absen pulang pukul ${t}` })
    }
  }

  const week: WeekDay[] = [
    { short: 'SEN', date: '16 Nov', state: 'done' },
    { short: 'SEL', date: '17 Nov', state: phase === 'belum' ? 'today' : 'done' },
    { short: 'RAB', date: '18 Nov', state: 'upcoming' },
    { short: 'KAM', date: '19 Nov', state: 'upcoming' },
    { short: 'JUM', date: '20 Nov', state: 'upcoming' },
  ]

  const statusText =
    phase === 'belum'
      ? 'Anda belum absen hari ini'
      : phase === 'masuk'
        ? `Sudah absen masuk pukul ${checkIn}`
        : `Absensi hari ini selesai (${checkIn} – ${checkOut})`

  return (
    <>
      <section
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-2 p-6 text-white shadow-lg shadow-blue-900/20 sm:p-8 lg:col-span-2"
        aria-labelledby="absen-heading"
      >
        <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-blue-500/30 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <h2 id="absen-heading" className="text-sm font-semibold tracking-wide text-blue-200 uppercase">
              Absensi hari ini
            </h2>
            <p className="text-5xl font-extrabold tracking-tight text-white tabular-nums sm:text-6xl" aria-live="off">
              {now ? timeFormat.format(now) : '--.--.--'}
            </p>
            <p className="text-lg text-blue-100">{now ? dateFormat.format(now) : '\u00a0'}</p>
            <p className="flex items-center gap-1.5 text-sm text-blue-200">
              <MapPin className="size-4" aria-hidden="true" />
              Kantor Pusat · Jl. Sudirman No. 21, Jakarta
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <p
              className={cn(
                'inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-sm font-semibold sm:self-end',
                phase === 'belum' ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-400/15 text-emerald-200',
              )}
              aria-live="polite"
            >
              {phase !== 'belum' && <CircleCheck className="size-4" aria-hidden="true" />}
              {statusText}
            </p>
            <button
              type="button"
              onClick={handleAbsen}
              disabled={phase === 'selesai'}
              className={cn(
                'flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl px-8 text-lg font-bold shadow-lg transition-all duration-200 sm:w-72',
                phase === 'belum' && 'bg-success text-white hover:-translate-y-0.5 hover:bg-emerald-800',
                phase === 'masuk' && 'bg-white text-navy hover:-translate-y-0.5 hover:bg-blue-50',
                phase === 'selesai' && 'cursor-not-allowed bg-white/15 text-blue-100 shadow-none',
              )}
            >
              {phase === 'masuk' ? (
                <LogOut className="size-6" aria-hidden="true" />
              ) : (
                <LogIn className="size-6" aria-hidden="true" />
              )}
              {phase === 'belum' ? 'Absen Masuk' : phase === 'masuk' ? 'Absen Pulang' : 'Sampai jumpa besok'}
            </button>
          </div>
        </div>
      </section>

      <Panel title="Kehadiran minggu ini" description="Jam kerja 08.00 – 17.00">
        <WeekChips days={week} />
        <p className="text-sm text-muted-foreground">
          {phase === 'belum' ? '1 dari 5 hari tercatat' : '2 dari 5 hari tercatat'} · tidak ada keterlambatan
        </p>
      </Panel>
    </>
  )
}
