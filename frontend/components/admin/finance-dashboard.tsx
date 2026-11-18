'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, CircleDollarSign, FileCheck2, Wallet } from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { StatIcon } from '@/components/ui/stat-icon'
import { formatRupiah } from '@/lib/mock-data'
import { getFinanceDashboardData } from '@/lib/services/report-service'

type FinanceData = Awaited<ReturnType<typeof getFinanceDashboardData>>

export function FinanceDashboard() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getFinanceDashboardData()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Ringkasan Keuangan gagal dimuat.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])

  if (loading) return <PageLoadingSkeleton label="dashboard Keuangan" />
  if (error) return <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
  if (!data) return <EmptyState title="Ringkasan belum tersedia" description="Muat ulang untuk mencoba kembali." icon={Wallet} />

  return (
    <div className="flex flex-col gap-6">
      <DemoDataNotice>
        Ringkasan menggunakan data penggajian demo. Jadwal pembayaran adalah tanggal contoh, saldo utang mengikuti jurnal yang tersimpan.
      </DemoDataNotice>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">Ringkasan Keuangan</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tinjau periode yang perlu divalidasi dan jadwal pembayaran.</p>
        </div>
        <Link href="/app/penggajian" className={buttonVariants({ variant: 'primary', size: 'action' })}>
          Buka penggajian
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Gaji menunggu validasi"
          value={data.pendingValidation ? '1 periode' : '0 periode'}
          hint={data.pendingValidation ? 'Perlu persetujuan Keuangan' : `Status periode: ${data.period.status}`}
          icon={FileCheck2}
          tone={data.pendingValidation ? 'amber' : 'green'}
        />
        <StatCard
          label="Jadwal pembayaran"
          value={data.paymentDate}
          hint="Jadwal contoh periode November 2026"
          icon={CalendarDays}
          tone="blue"
        />
        <StatCard
          label="Saldo utang gaji"
          value={formatRupiah(data.salaryPayable)}
          hint={data.salaryPayable ? 'Dari jurnal pengakuan gaji' : 'Belum ada jurnal pengakuan gaji'}
          icon={CircleDollarSign}
          highlight
        />
      </div>

      <Panel title="Periode November 2026" description="Status penggajian dan ringkasan pembayaran yang diproses.">
        <div className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <StatIcon icon={Wallet} tone="primary" size="md" />
            <div className="min-w-0">
              <p className="font-semibold text-heading">{data.employeeCount} karyawan</p>
              <p className="text-sm text-muted-foreground">Total gaji bersih {formatRupiah(data.totalNetPay)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={data.period.status} />
            <Link href="/app/penggajian/proses" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
              Tinjau proses
            </Link>
          </div>
        </div>
      </Panel>

      <Panel title="Tindak lanjut" description="Buka data yang diperlukan untuk validasi dan pencatatan akuntansi.">
        <div className="flex flex-wrap gap-3">
          <Link href="/app/penggajian" className={buttonVariants({ variant: 'primary', size: 'action' })}>Periksa status penggajian</Link>
          <Link href="/app/akuntansi/jurnal" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>Lihat jurnal umum</Link>
          <Link href="/app/laporan" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>Buka laporan</Link>
        </div>
      </Panel>
    </div>
  )
}
