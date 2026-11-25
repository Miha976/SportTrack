// Client HTTP minimal. Le proxy Vite redirige /api vers le backend FastAPI (port 8000).
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* corps non JSON */
    }
    throw new ApiError(res.status, msg)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

const body = (b: unknown) => (b instanceof FormData ? b : JSON.stringify(b))

export const http = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, b?: unknown) => request<T>(p, { method: 'POST', body: body(b ?? {}) }),
  put: <T>(p: string, b: unknown) => request<T>(p, { method: 'PUT', body: body(b) }),
  del: (p: string) => request<void>(p, { method: 'DELETE' }),
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && s.set(k, String(v)))
  const str = s.toString()
  return str ? `?${str}` : ''
}
