import { StatusBadge } from './status-badge'
import { Avatar } from '@/components/ui/avatar'
import type { AttendanceRow } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export function AttendanceTable({
  rows,
  caption,
  className,
}: {
  rows: AttendanceRow[]
  caption: string
  className?: string
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="py-3 pr-4 font-semibold">Karyawan</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Divisi</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Masuk</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Pulang</th>
            <th scope="col" className="py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-border/70 last:border-0">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    initials={row.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')}
                    size="md"
                    tone="muted"
                  />
                  <span className="font-semibold text-heading">{row.name}</span>
                </div>
              </td>
              <td className="py-3 pr-4">{row.division}</td>
              <td className="py-3 pr-4 tabular-nums">{row.checkIn}</td>
              <td className="py-3 pr-4 tabular-nums">{row.checkOut}</td>
              <td className="py-3">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
