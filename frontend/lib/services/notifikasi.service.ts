import { apiRequest, ApiError } from '@/lib/api/client'
import type { ApiMeta } from '@/lib/api/client'
import { config } from '@/lib/config'
import type { Role } from '@/lib/navigation'
import type { Notifikasi, NotifikasiListQuery } from '@/lib/types/notifikasi'
import {
  listNotifications as listNotificationsMock,
  markNotificationRead as markNotificationReadMock,
  markNotificationsRead as markNotificationsReadMock,
  notificationsChangedEvent,
  type AppNotification,
} from './notification-service'

export { notificationsChangedEvent }
export type { AppNotification }

function parseId(id: string) {
  const parsed = Number(id)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ApiError(0, 'INVALID_RESOURCE_ID', 'ID notifikasi harus berupa bilangan bulat positif dari API.')
  }
  return parsed
}

function toAppNotification(item: Notifikasi, unreadCount: number): AppNotification {
  return {
    id: String(item.id),
    title: item.judul,
    description: item.pesan,
    href: item.tautan,
    isRead: item.dibaca,
    unreadCount,
  }
}

export async function listNotifications(
  role: Role,
  employeeId = 'HP-0001',
  params: NotifikasiListQuery = {},
): Promise<AppNotification[]> {
  return (await listNotificationsWithCount(role, employeeId, params)).items
}

export async function listNotificationsWithCount(
  role: Role,
  employeeId = 'HP-0001',
  params: NotifikasiListQuery = {},
): Promise<{ items: AppNotification[]; unreadCount: number; meta: ApiMeta }> {
  const query = { ...params, page: params.page ?? 1, per_page: params.per_page ?? 10 }
  if (config.mock.notifikasi) {
    const allItems = await listNotificationsMock(role, employeeId)
    const filteredItems = params.belum_dibaca
      ? allItems.filter((item) => !item.isRead)
      : allItems
    const start = (query.page - 1) * query.per_page
    return {
      items: filteredItems.slice(start, start + query.per_page),
      unreadCount: allItems.filter((item) => !item.isRead).length,
      meta: {
        page: query.page,
        per_page: query.per_page,
        total: filteredItems.length,
        total_pages: Math.ceil(filteredItems.length / query.per_page),
      },
    }
  }
  const result = await apiRequest<Notifikasi[], { jumlah_belum_dibaca: number }>('notifikasi', { params: query })
  if (!result.meta) {
    throw new ApiError(200, 'PAGINATION_METADATA_MISSING', 'Respons notifikasi tidak menyertakan metadata halaman.')
  }
  return {
    items: result.data.map((item) => toAppNotification(item, result.jumlah_belum_dibaca)),
    unreadCount: result.jumlah_belum_dibaca,
    meta: result.meta,
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  if (config.mock.notifikasi) {
    markNotificationReadMock(id)
    return
  }
  await apiRequest<null>(`notifikasi/${parseId(id)}/baca`, { method: 'PATCH' })
}

export async function markNotificationsRead(
  notifications: AppNotification[],
  role?: Role,
  employeeId?: string,
): Promise<void> {
  if (config.mock.notifikasi) {
    const allNotifications = role
      ? await listNotificationsMock(role, employeeId)
      : notifications
    markNotificationsReadMock(allNotifications)
    return
  }
  await apiRequest<null>('notifikasi/baca-semua', { method: 'POST', body: {} })
}
