'use client'

import { ReceiptText } from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { formatRupiah, payslip } from '@/lib/mock-data'

export function PayslipCard() {
  const earnings = payslip.earnings.reduce((s, e) => s + e.amount, 0)
  const deductions = payslip.deductions.reduce((s, e) => s + e.amount, 0)

  return (
    <Panel title="Slip gaji terakhir" description={`Periode ${payslip.periode} · terbit ${payslip.issued}`}>
      <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success text-white">
          <ReceiptText className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-emerald-800">Gaji bersih diterima</p>
          <p className="text-2xl font-extrabold tracking-tight text-heading">{formatRupiah(payslip.net)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border p-3">
          <dt className="text-muted-foreground">Total pendapatan</dt>
          <dd className="font-bold text-heading">{formatRupiah(earnings)}</dd>
        </div>
        <div className="rounded-xl border border-border p-3">
          <dt className="text-muted-foreground">Total potongan</dt>
          <dd className="font-bold text-red-600">{formatRupiah(deductions)}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">Unduhan PDF belum tersedia.</p>
    </Panel>
  )
}
