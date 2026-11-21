import type { Id, Role } from './common'

export type LoginRequest = { email: string; password: string }
export type RefreshRequest = { refresh_token: string }
export type PasswordRequest = {
  password_lama: string
  password_baru: string
  konfirmasi_password: string
}

export type AuthUser = {
  id: Id
  karyawan_id: Id | null
  nama: string
  email?: string
  role: Role
  jabatan: string
  inisial: string
  foto_url?: string | null
}

export type AuthMe = AuthUser & { menu_access: string[] }
export type LoginResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  user: AuthUser
}
export type RefreshResponse = { access_token: string; expires_in: number }
export type LogoutResponse = null
export type PasswordResponse = null
