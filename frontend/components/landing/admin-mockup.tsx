import { CircleAlert, Clock, UserCheck, Users, Wallet } from 'lucide-react'
import { Sidebar } from '@/components/app/sidebar'
import { Topbar } from '@/components/app/topbar'
import { AttendanceChart } from '@/components/hadirpay/attendance-chart'
import { BrowserFrame } from '@/components/hadirpay/browser-frame'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { WeekChips } from '@/components/hadirpay/week-chips'
import { adminUser, adminWeek, recentAttendance } from '@/lib/mock-data'

export function AdminMockup() {
  return (
    <BrowserFrame compact url="app.hadirpay.id/dashboard">
      <div className="flex gap-2 bg-surface p-2 text-left">
        <div className="w-9 shrink-0">
          <Sidebar role="admin" activeHref="/app" mode="collapsed" size="sm" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Topbar title="Dashboard" user={adminUser} size="sm" />
          <div className="grid grid-cols-2 gap-1.5 min-[480px]:grid-cols-3 min-[768px]:grid-cols-5">
            <StatCard size="sm" label="Karyawan" value="48" icon={Users} />
            <StatCard size="sm" label="Hadir" value="41" icon={UserCheck} tone="green" />
            <StatCard size="sm" label="Terlambat" value="4" icon={Clock} tone="amber" />
            <StatCard size="sm" label="Tidak hadir" value="3" icon={CircleAlert} tone="red" />
            <StatCard size="sm" label="Total gaji" value="Rp186,4 jt" icon={Wallet} highlight />
          </div>
          <div className="grid grid-cols-1 gap-1.5 min-[640px]:grid-cols-5">
            <div className="rounded-lg border border-border bg-white p-1.5 min-[640px]:col-span-3">
              <p className="mb-1 text-[8px] font-bold text-heading">Tren kehadiran</p>
              <AttendanceChart height={84} compact />
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-white p-1.5 min-[640px]:col-span-2">
              <p className="text-[8px] font-bold text-heading">Minggu ini</p>
              <WeekChips days={adminWeek} size="sm" />
              <ul className="flex flex-col gap-1">
                {recentAttendance.slice(0, 3).map((r) => (
                  <li key={r.name} className="flex items-center justify-between gap-1">
                    <span className="truncate text-[7px] font-semibold text-heading">{r.name}</span>
                    <StatusBadge status={r.status} className="px-1 py-0 text-[6px] [&>span]:size-1" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}
