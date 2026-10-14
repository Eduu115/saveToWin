import { api } from './client'

export type Profile = {
  email: string
  name: string | null
  createdAt: string
  twoFactorEnabled: boolean
  recoveryCodesLeft: number
  /** El servidor puede enviar correo (cambios de email/contraseña). */
  emailConfigured: boolean
}

export type CodeSent = { sent: true; to: string }

export const fetchProfile = () => api<Profile>('/api/profile')

const post = <T>(path: string, body: unknown) =>
  api<T>(`/api/profile${path}`, { method: 'POST', body: JSON.stringify(body) })

export const requestPasswordChange = (currentPassword: string, newPassword: string) =>
  post<CodeSent>('/password', { currentPassword, newPassword })

export const requestEmailChange = (newEmail: string, currentPassword: string) =>
  post<CodeSent>('/email', { newEmail, currentPassword })

export const confirmCode = (purpose: 'password' | 'email', code: string) =>
  post<{ ok: true; email?: string }>('/confirm', { purpose, code })

export const setupTwoFactor = (currentPassword: string) =>
  post<{ secret: string; otpauthUrl: string }>('/2fa/setup', { currentPassword })

export const enableTwoFactor = (code: string) =>
  post<{ ok: true; recoveryCodes: string[] }>('/2fa/enable', { code })

export const disableTwoFactor = (currentPassword: string, code: string) =>
  post<{ ok: true }>('/2fa/disable', { currentPassword, code })
