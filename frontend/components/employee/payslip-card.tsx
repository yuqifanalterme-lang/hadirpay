'use client'

import { ReceiptText } from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { StatIcon } from '@/components/ui/stat-icon'
import { EmptyState } from '@/components/ui/empty-state'
import { formatRupiah } from '@/lib/mock-data'
import { formatTanggal } from '@/lib/format'
import type { DashboardKaryawan } from '@/lib/types/dashboard'

export function PayslipCard({ slip }: { slip: DashboardKaryawan['slip_terakhir'] }) {
  if (!slip) {
    return <Panel title="Slip gaji terakhir"><EmptyState title="Belum ada slip gaji" description="Slip gaji akan tampil setelah diterbitkan." icon={ReceiptText} /></Panel>
  }
  const period = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(`${slip.periode}-01T00:00:00`),
  )

  return (
    <Panel title="Slip gaji terakhir" description={`Periode ${period} · terbit ${formatTanggal(slip.tanggal_terbit)}`}>
      <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 p-4">
        <StatIcon icon={ReceiptText} tone="green" size="lg" />
        <div>
          <p className="text-sm font-medium text-emerald-800">Gaji bersih diterima</p>
          <p className="text-2xl font-extrabold tracking-tight text-heading">{formatRupiah(slip.gaji_bersih)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border p-3">
          <dt className="text-muted-foreground">Total pendapatan</dt>
          <dd className="font-bold text-heading">{formatRupiah(slip.total_pendapatan)}</dd>
        </div>
        <div className="rounded-xl border border-border p-3">
          <dt className="text-muted-foreground">Total potongan</dt>
          <dd className="font-bold text-red-600">{formatRupiah(slip.total_potongan)}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">Unduhan PDF belum tersedia.</p>
    </Panel>
  )
}
