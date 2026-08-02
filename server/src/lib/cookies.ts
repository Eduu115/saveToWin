import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { env } from './env.js'

export const AUTH_COOKIE = 'stw_token'

// ponytail: maxAge fijo 1d; parsear JWT_EXPIRES_IN si cambia el default
const COOKIE_MAX_AGE = 60 * 60 * 24

export function setAuthCookie(c: Context, token: string) {
  setCookie(c, AUTH_COOKIE, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: env.isProd(),
    maxAge: COOKIE_MAX_AGE,
  })
}

export function clearAuthCookie(c: Context) {
  deleteCookie(c, AUTH_COOKIE, { path: '/' })
}

export function readAuthCookie(c: Context) {
  return getCookie(c, AUTH_COOKIE)
}
