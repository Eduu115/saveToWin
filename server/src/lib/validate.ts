import type { Context } from 'hono'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'
import { apiError, type ApiErrorBody } from './errors.js'

export type { ApiErrorBody }
export { apiError }

export function validationError(err: ZodError): ApiErrorBody {
  return apiError('VALIDATION_ERROR', 'Datos inválidos', err.flatten())
}

/** Parsea JSON + zod. Devuelve datos o Response 400. */
export async function parseBody<T>(
  c: Context,
  schema: ZodType<T>,
): Promise<T | Response> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return c.json(apiError('VALIDATION_ERROR', 'JSON inválido'), 400)
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return c.json(validationError(parsed.error), 400)
  }
  return parsed.data
}

export function parseQuery<T>(
  c: Context,
  schema: ZodType<T>,
): T | Response {
  const parsed = schema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json(validationError(parsed.error), 400)
  }
  return parsed.data
}
