'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ClipboardCheck } from 'lucide-react'
import { AttendanceClock } from './attendance-clock'
import { PayslipCard } from './payslip-card'
import { GreetingCard } from '@/components/hadirpay/greeting-card'
import { Panel } from '@/components/hadirpay/panel'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { StatIcon } from '@/components/ui/stat-icon'
import { ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { formatTanggal } from '@/lib/format'
import { useAuth } from '@/lib/auth/auth-provider'
import { config } from '@/lib/config'
import { getLeaveQuota } from '@/lib/services/pengajuan.service'
import { getEmployeeDashboard } from '@/lib/services/dashboard.service'
import type { DashboardKaryawan } from '@/lib/types/dashboard'

export function EmployeeDashboard() {
  const auth = useAuth()
  const [data, setData] = useState<DashboardKaryawan | null>(null)
  const [quota, setQuota] = useState<{ cuti_sisa: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([getEmployeeDashboard(), getLeaveQuota()])
      .then(([dashboard, leaveQuota]) => {
        if (active) {
          setData(dashboard)
          setQuota(leaveQuota)
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Dashboard gagal dimuat.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])

  if (loading) return <PageLoadingSkeleton label="dashboard karyawan" />
  if (error) return <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
  if (!data) return <ErrorState message="Dashboard belum tersedia." onRetry={() => setRetry((value) => value + 1)} />

  const latestRequest = data.pengajuan_terakhir
  const requestStatus = latestRequest
    ? ({ menunggu: 'Menunggu persetujuan', disetujui: 'Disetujui', ditolak: 'Ditolak' } as const)[latestRequest.status]
    : undefined

  return (
    <div className="flex flex-col gap-6">
      <GreetingCard
        greeting={config.mock.dashboard
          ? 'Selamat pagi, Andi!'
          : auth.user?.nama
            ? `Selamat pagi, ${auth.user.nama}!`
            : 'Selamat pagi!'}
        message={`Semoga harimu menyenangkan. Jangan lupa absen masuk sebelum pukul ${data.jam_kerja.masuk.slice(0, 5)}, ya.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <AttendanceClock weeklyAttendance={data.kehadiran_minggu_ini} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PayslipCard slip={data.slip_terakhir} />

        <Panel title="Pengajuan terakhir" description="Status permohonan cuti dan izin Anda">
          {latestRequest && requestStatus ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <StatIcon icon={CalendarDays} tone="violet" size="lg" />
                <div>
                  <p className="text-lg font-bold text-heading">{latestRequest.judul}</p>
                  <p className="text-sm text-muted-foreground">Untuk tanggal {formatTanggal(latestRequest.tanggal_mulai)}</p>
                </div>
              </div>
              <StatusBadge status={requestStatus} />
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Diajukan</dt>
                <dd className="font-semibold text-heading">{formatTanggal(latestRequest.tanggal_diajukan)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Disetujui oleh</dt>
                <dd className="font-semibold text-heading">{latestRequest.disetujui_oleh ?? '—'}</dd>
              </div>
            </dl>
          </div>
          ) : (
            <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted-foreground">Belum ada pengajuan.</p>
          )}
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardCheck className="size-4 text-success" aria-hidden="true" />
            Sisa cuti tahunan Anda: <strong className="text-heading">{quota?.cuti_sisa ?? 0} hari</strong>
          </p>
          <Link
            href="/app/pengajuan-saya"
            className={buttonVariants({
              variant: 'outline',
              size: 'form',
              className: 'justify-center bg-white transition-colors duration-150',
            })}
          >
            Buat pengajuan baru
          </Link>
        </Panel>
      </div>
    </div>
  )
}
