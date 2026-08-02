export type ApiError = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export class ApiClientError extends Error {
  status: number
  body: ApiError | null

  constructor(status: number, body: ApiError | null) {
    super(body?.error.message ?? `HTTP ${status}`)
    this.name = 'ApiClientError'
    this.status = status
    this.body = body
  }
}

async function parseError(res: Response): Promise<ApiError | null> {
  try {
    return (await res.json()) as ApiError
  } catch {
    return null
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) {
    throw new ApiClientError(res.status, await parseError(res))
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
