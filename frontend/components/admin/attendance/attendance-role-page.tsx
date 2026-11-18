'use client'

import { useSyncExternalStore } from 'react'
import { AdminAttendancePage } from '@/components/admin/attendance/admin-attendance-page'
import { AttendancePage } from '@/components/employee/attendance-page'
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getStoredRole(): Role | null {
  const role = localStorage.getItem(ROLE_STORAGE_KEY)
  return role === 'admin' || role === 'karyawan' ? role : null
}

export function AttendanceRolePage() {
  const role = useSyncExternalStore(subscribe, getStoredRole, () => null)
  return role === 'admin' ? <AdminAttendancePage /> : <AttendancePage />
}
