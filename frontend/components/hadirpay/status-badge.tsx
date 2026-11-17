import type { AttendanceStatus } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export type StatusBadgeStatus =
  | AttendanceStatus
  | 'Menunggu persetujuan'
  | 'Sakit'
  | 'Seimbang'
  | 'Aktif'
  | 'Nonaktif'

const styles: Record<StatusBadgeStatus, string> = {
  Hadir: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Disetujui: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Seimbang: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Aktif: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Terlambat: 'bg-amber-50 text-amber-700 ring-amber-200',
  Menunggu: 'bg-amber-50 text-amber-700 ring-amber-200',
  'Menunggu persetujuan': 'bg-amber-50 text-amber-700 ring-amber-200',
  Alpha: 'bg-red-50 text-red-700 ring-red-200',
  Ditolak: 'bg-red-50 text-red-700 ring-red-200',
  Nonaktif: 'bg-slate-100 text-slate-700 ring-slate-200',
  Izin: 'bg-sky-50 text-sky-700 ring-sky-200',
  Sakit: 'bg-sky-50 text-sky-700 ring-sky-200',
  Cuti: 'bg-violet-50 text-violet-700 ring-violet-200',
}

const dots: Record<StatusBadgeStatus, string> = {
  Hadir: 'bg-success',
  Disetujui: 'bg-success',
  Seimbang: 'bg-success',
  Aktif: 'bg-success',
  Terlambat: 'bg-warning',
  Menunggu: 'bg-warning',
  'Menunggu persetujuan': 'bg-warning',
  Alpha: 'bg-destructive',
  Ditolak: 'bg-destructive',
  Nonaktif: 'bg-slate-500',
  Izin: 'bg-info',
  Sakit: 'bg-info',
  Cuti: 'bg-leave',
}

export function StatusBadge({
  status,
  className,
}: {
  status: StatusBadgeStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        styles[status],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', dots[status])} aria-hidden="true" />
      {status}
    </span>
  )
}
