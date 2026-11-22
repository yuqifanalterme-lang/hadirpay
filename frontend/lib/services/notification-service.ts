import type { Role } from '@/lib/navigation'
import { getPayrollPeriod } from '@/lib/services/payroll-service'
import { listRequests } from '@/lib/services/request-service'
import { notificationsChangedEvent } from '@/lib/services/request-events'

const readStorageKey = 'hadirpay-demo-notifications-read-v1'
export { notificationsChangedEvent }

export type AppNotification = {
  id: string
  title: string
  description: string
  href: string
  isRead: boolean
  unreadCount?: number
}

function readIds() {
  const stored = window.localStorage.getItem(readStorageKey)
  if (!stored) return new Set<string>()
  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch (error) {
    throw new Error('Status notifikasi tidak dapat dibaca.', { cause: error })
  }
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
    throw new Error('Format status notifikasi tidak valid.')
  }
  return new Set(parsed)
}

function writeIds(ids: Set<string>) {
  window.localStorage.setItem(readStorageKey, JSON.stringify([...ids]))
  window.dispatchEvent(new Event(notificationsChangedEvent))
}

export async function listNotifications(
  role: Role,
  employeeId = 'HP-0001',
): Promise<AppNotification[]> {
  const [requests, read] = await Promise.all([
    role === 'admin' || role === 'karyawan' ? listRequests() : Promise.resolve([]),
    Promise.resolve(readIds()),
  ])
  const notifications: Omit<AppNotification, 'isRead'>[] = []

  if (role === 'admin') {
    for (const request of requests.filter((item) => item.status === 'Menunggu persetujuan')) {
      notifications.push({
        id: `request-${request.id}`,
        title: `${request.type} dari ${request.name}`,
        description: `${request.department} · diajukan ${request.submittedAt}`,
        href: '/app/pengajuan',
      })
    }
  }

  if (role === 'karyawan') {
    for (const request of requests.filter((item) => item.employeeId === employeeId)) {
      notifications.push({
        id: `request-${request.id}`,
        title: `Pengajuan ${request.type}`,
        description: `${request.status} · ${request.startDate}`,
        href: '/app/pengajuan',
      })
    }
  }

  if (role === 'keuangan') {
    const period = await getPayrollPeriod()
    if (period.status === 'Menunggu validasi keuangan') {
      notifications.push({
        id: `payroll-${period.id}-finance-review`,
        title: 'Penggajian menunggu validasi',
        description: `${period.period} · ${period.employeeCount} karyawan`,
        href: '/app/penggajian',
      })
    }
  }

  return notifications
    .sort((a, b) => a.title.localeCompare(b.title, 'id-ID'))
    .map((item) => ({ ...item, isRead: read.has(item.id) }))
}

export function markNotificationRead(id: string) {
  const read = readIds()
  read.add(id)
  writeIds(read)
}

export function markNotificationsRead(notifications: AppNotification[]) {
  const read = readIds()
  notifications.forEach((item) => read.add(item.id))
  writeIds(read)
}
