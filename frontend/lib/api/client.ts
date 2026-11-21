import { toast } from 'sonner'
import { config } from '@/lib/config'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from '@/lib/auth/token'

export type ApiMeta = {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export type ApiResult<T> = {
  data: T
  meta?: ApiMeta
  [extra: string]: unknown
}

export type ApiErrorFields = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly errors?: ApiErrorFields

  constructor(status: number, code: string, message: string, errors?: ApiErrorFields) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

type QueryValue = string | number | boolean | null | undefined

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  params?: Record<string, QueryValue>
  body?: unknown
  formData?: FormData
  responseType?: 'json' | 'blob'
  timeoutMs?: number
  skipAuth?: boolean
}

type ApiEnvelope<T> = {
  success: boolean
  message: string
  data: T
  meta?: ApiMeta
  code?: string
  errors?: ApiErrorFields
}

const DEFAULT_TIMEOUT_MS = 15_000
type RefreshOutcome = 'refreshed' | 'invalid' | 'unavailable'
let refreshInFlight: Promise<RefreshOutcome> | null = null

function buildUrl(path: string, params?: ApiRequestOptions['params']) {
  if (!config.apiUrl) {
    throw new ApiError(0, 'API_URL_MISSING', 'Alamat layanan API belum dikonfigurasi.')
  }
  const url = new URL(`${config.apiUrl}/${path.replace(/^\/+/, '')}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  return url
}

function friendlyNetworkMessage() {
  return 'Layanan sedang sulit dijangkau. Periksa koneksi Anda, lalu coba lagi.'
}

function refreshNetworkMessage() {
  return 'Koneksi bermasalah, coba lagi'
}

function toApiError(status: number, envelope: Partial<ApiEnvelope<unknown>>): ApiError {
  const code = envelope.code ?? (status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED')
  const fallbackMessages: Record<string, string> = {
    INSUFFICIENT_LEAVE_QUOTA: 'Kuota cuti tidak mencukupi. Periksa kembali sisa cuti Anda.',
    INVALID_STATUS_TRANSITION: 'Status pengajuan sudah berubah. Muat ulang data, lalu coba lagi.',
    JOURNAL_NOT_BALANCED: 'Total debit dan kredit belum seimbang. Periksa kembali nominal jurnal.',
    INVALID_CREDENTIALS: 'Email atau kata sandi tidak sesuai. Periksa kembali data masuk Anda.',
  }
  const fallbackMessage = fallbackMessages[code] ?? (status >= 500
    ? 'Terjadi gangguan pada layanan. Coba lagi beberapa saat.'
    : 'Permintaan tidak dapat diproses.')
  const message = typeof envelope.message === 'string' && envelope.message.trim()
    ? envelope.message
    : fallbackMessage
  const error = new ApiError(status, code, message, envelope.errors)

  if (status === 403) toast.error(message)
  else if (status >= 500) toast.error('Terjadi gangguan pada layanan. Coba lagi beberapa saat.')
  return error
}

async function readError(response: Response): Promise<ApiError> {
  let envelope: Partial<ApiEnvelope<unknown>> = {}
  try {
    envelope = await response.json() as Partial<ApiEnvelope<unknown>>
  } catch {
    envelope = {}
  }
  return toApiError(response.status, envelope)
}

async function refreshAccessToken(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight
  const refreshToken = getRefreshToken()
  if (!refreshToken || !config.apiUrl) return 'invalid'

  const pending = (async (): Promise<RefreshOutcome> => {
    let response: Response
    try {
      response = await fetchWithTimeout(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: { refresh_token: refreshToken },
        skipAuth: true,
      }, false, false)
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'REQUEST_TIMEOUT' || error.code === 'NETWORK_ERROR')) {
        toast.error(refreshNetworkMessage())
        return 'unavailable'
      }
      throw error
    }

    if (response.status === 401 || response.status === 403) return 'invalid'
    if (!response.ok) {
      if (response.status >= 500) {
        toast.error(refreshNetworkMessage())
        return 'unavailable'
      }
      return 'invalid'
    }

    let envelope: ApiEnvelope<{ access_token: string; expires_in: number }>
    try {
      envelope = await response.json() as ApiEnvelope<{ access_token: string; expires_in: number }>
    } catch {
      toast.error(refreshNetworkMessage())
      return 'unavailable'
    }
    if (!envelope.success || typeof envelope.data?.access_token !== 'string') return 'invalid'
    setAccessToken(envelope.data.access_token)
    return 'refreshed'
  })()
  refreshInFlight = pending
  try {
    return await pending
  } finally {
    if (refreshInFlight === pending) refreshInFlight = null
  }
}

function expireSession() {
  clearTokens()
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

async function fetchWithTimeout(
  url: URL,
  options: ApiRequestOptions,
  retryAfterRefresh: boolean,
  toastNetworkErrors = true,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const externalSignal = options.signal
  const abortFromExternal = () => controller.abort()
  if (externalSignal?.aborted) controller.abort()
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true })

  const headers = new Headers(options.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', options.responseType === 'blob' ? '*/*' : 'application/json')
  }
  if (options.formData) headers.delete('Content-Type')
  else if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!options.skipAuth) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      body: options.formData ?? (
        options.body === undefined ? undefined : JSON.stringify(options.body)
      ),
      signal: controller.signal,
    })
    if (response.status === 401 && retryAfterRefresh && !options.skipAuth) {
      const refreshOutcome = await refreshAccessToken()
      if (refreshOutcome === 'refreshed') return fetchWithTimeout(url, options, false)
      if (refreshOutcome === 'invalid') expireSession()
    } else if (response.status === 401 && !retryAfterRefresh && !options.skipAuth) {
      expireSession()
    }
    return response
  } catch (error) {
    if (externalSignal?.aborted) throw error
    if (error instanceof ApiError) throw error
    const message = controller.signal.aborted
      ? 'Permintaan melewati batas waktu. Coba lagi.'
      : friendlyNetworkMessage()
    if (toastNetworkErrors) toast.error(message)
    throw new ApiError(0, controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR', message)
  } finally {
    clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', abortFromExternal)
  }
}

export async function apiRequest<T, Extra extends Record<string, unknown> = Record<string, never>>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T> & Extra> {
  const response = await fetchWithTimeout(buildUrl(path, options.params), options, true)
  if (!response.ok) throw await readError(response)

  let envelope: ApiEnvelope<T>
  try {
    envelope = await response.json() as ApiEnvelope<T>
  } catch {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Respons layanan tidak dapat dibaca.')
  }
  if (!envelope.success) throw toApiError(response.status, envelope)
  const { success: _success, message: _message, data, meta, ...extra } = envelope
  return {
    ...extra,
    data,
    ...(meta ? { meta } : {}),
  } as ApiResult<T> & Extra
}

export async function apiBlob(path: string, options: ApiRequestOptions = {}): Promise<Blob> {
  const response = await fetchWithTimeout(buildUrl(path, options.params), {
    ...options,
    headers: { Accept: '*/*', ...options.headers },
    responseType: 'blob',
  }, true)
  if (!response.ok) throw await readError(response)
  return response.blob()
}
