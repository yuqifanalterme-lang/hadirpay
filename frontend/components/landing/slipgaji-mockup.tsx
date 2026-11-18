import { Download, FileText } from 'lucide-react'
import { Sidebar } from '@/components/app/sidebar'
import { Topbar } from '@/components/app/topbar'
import { BrowserFrame } from '@/components/hadirpay/browser-frame'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { adminUser, formatRupiah, payslip } from '@/lib/mock-data'

export function SlipGajiMockup() {
  return (
    <BrowserFrame compact url="app.hadirpay.id/slip-gaji">
      <div className="flex gap-2 bg-surface p-2 text-left">
        <div className="w-9 shrink-0">
          <Sidebar role="admin" activeHref="/app/slip-gaji" mode="collapsed" size="sm" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Topbar title="Slip Gaji" user={adminUser} size="sm" />
          <div className="rounded-lg border border-border bg-white p-1.5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[8px] font-bold text-heading">Slip gaji · Oktober 2026</p>
              <StatusBadge status="Dibayar" className="px-1 py-0 text-[6px]" />
            </div>
            <div className="mt-1 rounded-md bg-navy-2 p-2 text-white">
              <p className="text-[6px] text-blue-100">Gaji bersih</p>
              <p className="text-[10px] font-bold">{formatRupiah(payslip.net)}</p>
              <p className="mt-0.5 text-[6px] text-blue-100">Andi Wijaya · Staf Keuangan</p>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <div>
                <p className="text-[7px] font-semibold text-heading">Pendapatan</p>
                {payslip.earnings.slice(0, 2).map((e) => (
                  <div key={e.label} className="flex justify-between gap-1 border-b border-border/50 py-0.5">
                    <span className="truncate text-[6px] text-muted-foreground">{e.label}</span>
                    <span className="shrink-0 text-[6px] font-medium tabular-nums text-heading">{formatRupiah(e.amount)}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[7px] font-semibold text-heading">Potongan</p>
                {payslip.deductions.slice(0, 2).map((d) => (
                  <div key={d.label} className="flex justify-between gap-1 border-b border-border/50 py-0.5">
                    <span className="truncate text-[6px] text-muted-foreground">{d.label}</span>
                    <span className="shrink-0 text-[6px] font-medium tabular-nums text-heading">{formatRupiah(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className="inline-flex items-center gap-0.5 rounded bg-surface px-1 py-0.5 text-[6px] font-semibold text-muted-foreground">
                <Download className="size-2" />
                Unduh PDF
              </span>
              <span className="inline-flex items-center gap-0.5 text-[6px] text-muted-foreground">
                <FileText className="size-2" />
                HP-0001
              </span>
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

