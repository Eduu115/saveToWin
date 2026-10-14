import { api } from './client'
import type { User } from '../domain'

export function fetchRegistration() {
  return api<{ open: boolean }>('/api/auth/registration')
}

export function fetchMe() {
  return api<{ user: User }>('/api/auth/me')
}

/** Con 2FA activa no hay sesión aún: devuelve un reto para `loginTwoFactor`. */
export function login(body: { email: string; password: string }) {
  return api<{ user: User } | { twoFactorRequired: true; challenge: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function loginTwoFactor(body: { challenge: string; code: string }) {
  return api<{ user: User }>('/api/auth/login/2fa', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function register(body: { email: string; password: string; name?: string }) {
  return api<{ user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function logout() {
  return api<{ ok: true }>('/api/auth/logout', { method: 'POST' })
}

export function updateMe(body: { savingsGoalCents?: number; name?: string | null }) {
  return api<{ user: User }>('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
