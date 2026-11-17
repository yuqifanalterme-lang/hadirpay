'use client'

import { useSyncExternalStore } from 'react'
import { AdminRequestsPage } from '@/components/admin/requests-page'
import { RequestsPage } from '@/components/employee/requests-page'
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getStoredRole(): Role | null {
  const role = localStorage.getItem(ROLE_STORAGE_KEY)
  return role === 'admin' || role === 'karyawan' ? role : null
}

export function RequestsRolePage() {
  const role = useSyncExternalStore(subscribe, getStoredRole, () => null)
  return role === 'karyawan' ? <RequestsPage /> : <AdminRequestsPage />
}
