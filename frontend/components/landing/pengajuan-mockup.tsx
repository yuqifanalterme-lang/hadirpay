import { CalendarDays, ClipboardCheck, Inbox } from 'lucide-react'
import { Sidebar } from '@/components/app/sidebar'
import { Topbar } from '@/components/app/topbar'
import { BrowserFrame } from '@/components/hadirpay/browser-frame'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { adminUser } from '@/lib/mock-data'

const mockRows = [
  { name: 'Andi Wijaya', initials: 'AW', position: 'Staf Keuangan', dept: 'Keuangan', type: 'Cuti', date: '24–26 Nov', status: 'Disetujui' as const },
  { name: 'Budi Santoso', initials: 'BS', position: 'Staf Gudang', dept: 'Gudang', type: 'Cuti', date: '24–26 Nov', status: 'Menunggu' as const },
  { name: 'Siti Rahmawati', initials: 'SR', position: 'Marketing', dept: 'Pemasaran', type: 'Izin', date: '18 Nov', status: 'Menunggu' as const },
]

export function PengajuanMockup() {
  return (
    <BrowserFrame compact url="app.hadirpay.id/pengajuan">
      <div className="flex gap-2 bg-surface p-2 text-left">
        <div className="w-9 shrink-0">
          <Sidebar role="admin" activeHref="/app/pengajuan" mode="collapsed" size="sm" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Topbar title="Pengajuan" user={adminUser} size="sm" />
          <div className="grid grid-cols-2 gap-1.5">
            <StatCard size="sm" label="Menunggu" value="2" icon={ClipboardCheck} tone="amber" />
            <StatCard size="sm" label="Sisa cuti" value="9 hari" icon={CalendarDays} tone="violet" />
          </div>
          <div className="rounded-lg border border-border bg-white p-1.5">
            <p className="mb-1 text-[8px] font-bold text-heading">Antrian persetujuan</p>
            <ul className="flex flex-col gap-1">
              {mockRows.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-1 border-b border-border/50 pb-1 last:border-0 last:pb-0">
                  <div className="flex items-center gap-1">
                    <Avatar initials={r.initials} size="xs" tone="outlined" />
                    <div className="min-w-0">
                      <p className="truncate text-[7px] font-semibold text-heading">{r.name}</p>
                      <p className="truncate text-[6px] text-muted-foreground">{r.type} · {r.date}</p>
                    </div>
                  </div>
                  <StatusBadge status={r.status} className="px-1 py-0 text-[6px]" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

