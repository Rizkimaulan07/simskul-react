import { ApiError } from './api-error'

export { ApiError } from './api-error'

/** Demo statis untuk GitHub Pages: API diganti data contoh di browser. */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === '1'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null

  if (!response.ok) {
    throw new ApiError(
      payload?.error ?? payload?.message ?? `Permintaan gagal (${response.status}).`,
      response.status,
    )
  }

  return payload as T
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (isDemoMode) {
    const { demoRequest } = await import('./demo-api')
    return demoRequest<T>(path, options.method ?? 'GET', options.body)
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(
      'Tidak dapat menghubungi server. Pastikan API SIMSKUL sedang berjalan.',
      0,
    )
  }

  return parseResponse<T>(response)
}

async function requestUpload<T>(path: string, form: FormData): Promise<T> {
  if (isDemoMode) {
    const { demoUpload } = await import('./demo-api')
    return demoUpload<T>(path, form)
  }

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      body: form,
    })
  } catch {
    throw new ApiError(
      'Tidak dapat menghubungi server. Pastikan API SIMSKUL sedang berjalan.',
      0,
    )
  }

  return parseResponse<T>(response)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => requestUpload<T>(path, form),
}

export function apiErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Terjadi kesalahan yang tidak diketahui.'
}
