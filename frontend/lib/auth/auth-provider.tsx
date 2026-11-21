'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthMe } from '@/lib/types/auth'
import type { Role as ApiRole } from '@/lib/types/common'
import { config } from '@/lib/config'
import { authChangedEvent, clearTokens, getAccessToken } from '@/lib/auth/token'
import { getMe, logout as logoutService, toUiRole } from '@/lib/services/auth.service'
import { ROLE_STORAGE_KEY, roleChangedEvent, type Role as UiRole } from '@/lib/navigation'

type AuthContextValue = {
  user: AuthMe | null
  role: UiRole | null
  menuAccess: string[]
  loading: boolean
  reloadUser: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isApiRole(value: unknown): value is ApiRole {
  return value === 'admin_hrd' || value === 'karyawan' || value === 'keuangan' || value === 'pemilik'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthMe | null>(null)
  const [loading, setLoading] = useState(!config.mock.auth)

  const reloadUser = useCallback(async () => {
    if (config.mock.auth) {
      setLoading(false)
      return
    }
    if (!getAccessToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const currentUser = await getMe()
      if (!isApiRole(currentUser.role)) throw new Error('Peran akun dari server tidak dikenal.')
      setUser(currentUser)
      localStorage.setItem(ROLE_STORAGE_KEY, toUiRole(currentUser.role))
      window.dispatchEvent(new Event(roleChangedEvent))
    } catch (error) {
      clearTokens()
      localStorage.removeItem(ROLE_STORAGE_KEY)
      window.dispatchEvent(new Event(roleChangedEvent))
      setUser(null)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (config.mock.auth) {
      setLoading(false)
      return
    }
    let active = true
    const load = () => {
      void reloadUser().catch(() => {
        if (active) setUser(null)
      })
    }
    load()
    window.addEventListener(authChangedEvent, load)
    window.addEventListener('storage', load)
    return () => {
      active = false
      window.removeEventListener(authChangedEvent, load)
      window.removeEventListener('storage', load)
    }
  }, [reloadUser])

  const logout = useCallback(async () => {
    if (config.mock.auth) {
      setUser(null)
      return
    }
    try {
      await logoutService()
    } finally {
      setUser(null)
      localStorage.removeItem(ROLE_STORAGE_KEY)
      window.dispatchEvent(new Event(roleChangedEvent))
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    role: user ? toUiRole(user.role) : null,
    menuAccess: user?.menu_access ?? [],
    loading,
    reloadUser,
    logout,
  }), [user, loading, reloadUser, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider.')
  return context
}
