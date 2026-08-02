export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function apiError(
  code: string,
  message: string,
  details?: unknown,
): ApiErrorBody {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } }
}
