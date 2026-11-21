import { apiRequest } from '@/lib/api/client'
import type { AuthMe, LoginRequest, LoginResponse, PasswordRequest, RefreshRequest, RefreshResponse } from '@/lib/types/auth'
import type { Role } from '@/lib/types/common'
import { config } from '@/lib/config'
import { clearTokens, getRefreshToken, setTokens } from '@/lib/auth/token'
import { authenticateDemoRole, updateDemoPassword } from './auth-service'
import type { Role as UiRole } from '@/lib/navigation'

export { authenticateDemoRole, updateDemoPassword }

export function toUiRole(role: Role): UiRole {
  return role === 'admin_hrd' ? 'admin' : role
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const result = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
    skipAuth: true,
  })
  setTokens(result.data.access_token, result.data.refresh_token)
  return result.data
}

export async function loginWithCredentials(
  email: string,
  password: string,
  demoRole: UiRole,
): Promise<UiRole> {
  if (config.mock.auth) {
    await authenticateDemoRole(demoRole, password)
    return demoRole
  }
  const response = await login({ email, password })
  return toUiRole(response.user.role)
}

export async function refresh(): Promise<RefreshResponse> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('Sesi telah berakhir. Silakan masuk kembali.')
  const result = await apiRequest<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken } satisfies RefreshRequest,
    skipAuth: true,
  })
  setTokens(result.data.access_token)
  return result.data
}

export async function getMe(): Promise<AuthMe> {
  const result = await apiRequest<AuthMe>('/auth/me')
  return result.data
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<null>('/auth/logout', { method: 'POST' })
  } finally {
    clearTokens()
  }
}

export async function changePassword(request: PasswordRequest): Promise<void> {
  await apiRequest<null>('/auth/password', { method: 'PUT', body: request })
}

export async function updatePasswordForRole(
  role: UiRole,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (config.mock.auth) {
    await updateDemoPassword(role, currentPassword, newPassword)
    return
  }
  await changePassword({
    password_lama: currentPassword,
    password_baru: newPassword,
    konfirmasi_password: newPassword,
  })
}
