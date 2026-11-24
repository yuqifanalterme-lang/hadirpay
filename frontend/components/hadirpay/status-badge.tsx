import type { AttendanceStatus } from '@/lib/mock-data'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatusBadgeStatus =
  | AttendanceStatus
  | 'Dinas Luar'
  | 'Menunggu persetujuan'
  | 'Menunggu validasi keuangan'
  | 'Draft'
  | 'Dibayar'
  | 'Sakit'
  | 'Seimbang'
  | 'Tidak seimbang'
  | 'Otomatis'
  | 'Manual'
  | 'Aktif'
  | 'Nonaktif'
  | 'Dibatalkan'

const styles: Record<StatusBadgeStatus, string> = {
  Hadir: 'bg-success text-white',
  Disetujui: 'bg-success text-white',
  Seimbang: 'bg-success text-white',
  'Tidak seimbang': 'bg-red-600 text-white',
  Otomatis: 'bg-sky-700 text-white',
  Manual: 'bg-slate-600 text-white',
  Aktif: 'bg-success text-white',
  Terlambat: 'bg-amber-700 text-white',
  Menunggu: 'bg-amber-700 text-white',
  'Menunggu persetujuan': 'bg-amber-700 text-white',
  'Menunggu validasi keuangan': 'bg-amber-700 text-white',
  Draft: 'bg-slate-600 text-white',
  Dibayar: 'bg-success text-white',
  Alpha: 'bg-red-600 text-white',
  Ditolak: 'bg-red-600 text-white',
  Nonaktif: 'bg-slate-600 text-white',
  Dibatalkan: 'bg-slate-600 text-white',
  Izin: 'bg-sky-700 text-white',
  Sakit: 'bg-sky-700 text-white',
  Cuti: 'bg-violet-700 text-white',
  'Dinas Luar': 'bg-sky-700 text-white',
}

export function StatusBadge({
  status,
  className,
  children,
}: {
  status: StatusBadgeStatus
  className?: string
  children?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap',
        styles[status] ?? 'bg-slate-600 text-white',
        className,
      )}
    >
      {children ?? status}
    </span>
  )
}
