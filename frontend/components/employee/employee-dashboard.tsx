import Link from 'next/link'
import { CalendarDays, ClipboardCheck } from 'lucide-react'
import { AttendanceClock } from './attendance-clock'
import { PayslipCard } from './payslip-card'
import { GreetingCard } from '@/components/hadirpay/greeting-card'
import { Panel } from '@/components/hadirpay/panel'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { StatIcon } from '@/components/ui/stat-icon'
import { latestRequest } from '@/lib/mock-data'

export function EmployeeDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <GreetingCard
        greeting="Selamat pagi, Andi!"
        message="Semoga harimu menyenangkan. Jangan lupa absen masuk sebelum pukul 08.00, ya."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <AttendanceClock />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PayslipCard />

        <Panel title="Pengajuan terakhir" description="Status permohonan cuti dan izin Anda">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <StatIcon icon={CalendarDays} tone="violet" size="lg" />
                <div>
                  <p className="text-lg font-bold text-heading">{latestRequest.type}</p>
                  <p className="text-sm text-muted-foreground">Untuk tanggal {latestRequest.date}</p>
                </div>
              </div>
              <StatusBadge status={latestRequest.status} />
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Diajukan</dt>
                <dd className="font-semibold text-heading">{latestRequest.submitted}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Disetujui oleh</dt>
                <dd className="font-semibold text-heading">{latestRequest.approver}</dd>
              </div>
            </dl>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardCheck className="size-4 text-success" aria-hidden="true" />
            Sisa cuti tahunan Anda: <strong className="text-heading">8 hari</strong>
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
