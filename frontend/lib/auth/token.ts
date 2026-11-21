const ACCESS_TOKEN_KEY = 'hadirpay-access-token'
const REFRESH_TOKEN_KEY = 'hadirpay-refresh-token'
export const authChangedEvent = 'hadirpay-auth-changed'

function read(key: string): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key)
}

function write(key: string, value: string | null) {
  if (typeof window === 'undefined') {
    throw new Error('Token autentikasi hanya dapat disimpan di browser.')
  }
  if (value === null) window.localStorage.removeItem(key)
  else window.localStorage.setItem(key, value)
  window.dispatchEvent(new Event(authChangedEvent))
}

export const getAccessToken = () => read(ACCESS_TOKEN_KEY)
export const getRefreshToken = () => read(REFRESH_TOKEN_KEY)
export const setAccessToken = (token: string | null) => write(ACCESS_TOKEN_KEY, token)
export const setRefreshToken = (token: string | null) => write(REFRESH_TOKEN_KEY, token)

export function setTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === 'undefined') {
    throw new Error('Token autentikasi hanya dapat disimpan di browser.')
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken !== undefined) window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  window.dispatchEvent(new Event(authChangedEvent))
}

export function clearTokens() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
  window.dispatchEvent(new Event(authChangedEvent))
}
