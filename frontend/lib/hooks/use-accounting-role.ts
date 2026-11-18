'use client'

import { useEffect, useState } from 'react'
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'

const roles: Role[] = ['admin', 'keuangan', 'karyawan', 'pemilik']

export function useAccountingRole() {
  const [role, setRole] = useState<Role | null | undefined>(undefined)

  useEffect(() => {
    const stored = localStorage.getItem(ROLE_STORAGE_KEY)
    setRole(roles.includes(stored as Role) ? stored as Role : null)
  }, [])

  return role
}
