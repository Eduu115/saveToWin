import { hash, verify } from 'argon2'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { authCodes, users } from '../../db/schema.js'
import type { AuthVariables } from '../lib/auth.js'
import { clearAuthCookie } from '../lib/cookies.js'
import { apiError } from '../lib/errors.js'
import { mailConfigured, MailNotConfiguredError, maskEmail, sendMail } from '../lib/mail.js'
import {
  emailCode,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecovery,
  otpauthUrl,
  sha256,
  verifyTotp,
} from '../lib/totp.js'
import { parseBody } from '../lib/validate.js'

type Env = { Variables: AuthVariables }

const CODE_TTL_MIN = 15
const MAX_ATTEMPTS = 5

export const profileRoutes = new Hono<Env>()

async function currentUser(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return user
}

/** Contraseña actual o 401: toda operación sensible la pide. */
async function checkPassword(userId: number, password: string) {
  const user = await currentUser(userId)
  if (!user || !(await verify(user.passwordHash, password))) return null
  return user
}

const wrongPassword = () => apiError('UNAUTHORIZED', 'La contraseña actual no es correcta')

async function sendOrFail(to: string, subject: string, text: string) {
  try {
    await sendMail(to, subject, text)
    return null
  } catch (err) {
    if (err instanceof MailNotConfiguredError) {
      return apiError('EMAIL_NOT_CONFIGURED', 'Este servidor no tiene el correo configurado')
    }
    console.error('[mail]', err)
    return apiError('EMAIL_FAILED', 'No se pudo enviar el correo, inténtalo más tarde')
  }
}

/** Guarda (sustituyendo el anterior) un código de confirmación y lo envía. */
async function issueCode(userId: number, purpose: 'password' | 'email', payload: string, to: string) {
  const code = emailCode()
  await db.delete(authCodes).where(and(eq(authCodes.userId, userId), eq(authCodes.purpose, purpose)))
  await db.insert(authCodes).values({
    userId,
    purpose,
    codeHash: sha256(code),
    payload,
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
  })
  const subject =
    purpose === 'password' ? 'saveToWin · confirma tu nueva contraseña' : 'saveToWin · confirma tu nuevo email'
  const what = purpose === 'password' ? 'cambiar tu contraseña' : 'usar este email en saveToWin'
  return sendOrFail(
    to,
    subject,
    `Tu código para ${what} es:\n\n    ${code}\n\nCaduca en ${CODE_TTL_MIN} minutos. Si no has sido tú, ignora este correo: no se cambiará nada.\n\n— saveToWin`,
  )
}

profileRoutes.get('/', async (c) => {
  const user = await currentUser(c.get('userId'))
  if (!user) return c.json(apiError('UNAUTHORIZED', 'Usuario no encontrado'), 401)
  return c.json({
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    twoFactorEnabled: user.totpEnabledAt != null,
    recoveryCodesLeft: user.totpRecovery.length,
    emailConfigured: mailConfigured(),
  })
})

const passwordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La nueva contraseña necesita al menos 8 caracteres'),
})

/** Cambio de contraseña: se aplica solo al confirmar el código enviado al email. */
profileRoutes.post('/password', async (c) => {
  const body = await parseBody(c, passwordBody)
  if (body instanceof Response) return body
  const user = await checkPassword(c.get('userId'), body.currentPassword)
  if (!user) return c.json(wrongPassword(), 401)
  const failed = await issueCode(user.id, 'password', await hash(body.newPassword), user.email)
  if (failed) return c.json(failed, 503)
  return c.json({ sent: true, to: maskEmail(user.email) })
})

const emailBody = z.object({
  newEmail: z.string().email('Email no válido'),
  currentPassword: z.string().min(1),
})

/** Cambio de email: el código va al email NUEVO (demuestra que es tuyo). */
profileRoutes.post('/email', async (c) => {
  const body = await parseBody(c, emailBody)
  if (body instanceof Response) return body
  const user = await checkPassword(c.get('userId'), body.currentPassword)
  if (!user) return c.json(wrongPassword(), 401)
  const newEmail = body.newEmail.trim().toLowerCase()
  if (newEmail === user.email) return c.json(apiError('VALIDATION_ERROR', 'Ese ya es tu email'), 400)
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail)).limit(1)
  if (taken) return c.json(apiError('CONFLICT', 'Ese email ya está en uso'), 409)
  const failed = await issueCode(user.id, 'email', newEmail, newEmail)
  if (failed) return c.json(failed, 503)
  return c.json({ sent: true, to: maskEmail(newEmail) })
})

const confirmBody = z.object({
  purpose: z.enum(['password', 'email']),
  code: z.string().trim().regex(/^\d{6}$/, 'El código son 6 dígitos'),
})

profileRoutes.post('/confirm', async (c) => {
  const body = await parseBody(c, confirmBody)
  if (body instanceof Response) return body
  const userId = c.get('userId')
  const [pending] = await db
    .select()
    .from(authCodes)
    .where(and(eq(authCodes.userId, userId), eq(authCodes.purpose, body.purpose)))
    .limit(1)
  const expired = !pending || pending.expiresAt.getTime() < Date.now() || pending.attempts >= MAX_ATTEMPTS
  if (expired) {
    if (pending) await db.delete(authCodes).where(eq(authCodes.id, pending.id))
    return c.json(apiError('CODE_EXPIRED', 'El código ha caducado. Pide uno nuevo.'), 410)
  }
  if (pending.codeHash !== sha256(body.code)) {
    await db.update(authCodes).set({ attempts: pending.attempts + 1 }).where(eq(authCodes.id, pending.id))
    return c.json(apiError('CODE_INVALID', 'El código no es correcto'), 400)
  }
  await db.delete(authCodes).where(eq(authCodes.id, pending.id))

  const user = await currentUser(userId)
  if (!user) return c.json(apiError('UNAUTHORIZED', 'Usuario no encontrado'), 401)
  if (body.purpose === 'password') {
    // ponytail: las otras sesiones abiertas siguen valiendo hasta que caduque su JWT
    // (JWT_EXPIRES_IN); añadir versión de sesión en el token si hace falta cortarlas ya.
    await db.update(users).set({ passwordHash: pending.payload }).where(eq(users.id, userId))
    await sendOrFail(user.email, 'saveToWin · tu contraseña ha cambiado', 'Tu contraseña de saveToWin se acaba de cambiar. Si no has sido tú, contacta con quien administra el servidor.\n\n— saveToWin')
    return c.json({ ok: true })
  }
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, pending.payload)).limit(1)
  if (taken) return c.json(apiError('CONFLICT', 'Ese email ya está en uso'), 409)
  await db.update(users).set({ email: pending.payload }).where(eq(users.id, userId))
  // Aviso (sin bloquear) al email anterior.
  await sendOrFail(user.email, 'saveToWin · tu email ha cambiado', `El email de tu cuenta de saveToWin ahora es ${maskEmail(pending.payload)}. Si no has sido tú, contacta con quien administra el servidor.\n\n— saveToWin`)
  return c.json({ ok: true, email: pending.payload })
})

// ——— 2FA (TOTP) ———

const passwordOnly = z.object({ currentPassword: z.string().min(1) })

/** Paso 1: genera un secreto pendiente (aún no activo) y devuelve la URL para el QR. */
profileRoutes.post('/2fa/setup', async (c) => {
  const body = await parseBody(c, passwordOnly)
  if (body instanceof Response) return body
  const user = await checkPassword(c.get('userId'), body.currentPassword)
  if (!user) return c.json(wrongPassword(), 401)
  if (user.totpEnabledAt) return c.json(apiError('CONFLICT', 'La verificación en dos pasos ya está activa'), 409)
  const secret = generateTotpSecret()
  await db.update(users).set({ totpSecret: secret }).where(eq(users.id, user.id))
  return c.json({ secret, otpauthUrl: otpauthUrl(secret, user.email) })
})

const codeOnly = z.object({ code: z.string().trim().min(6).max(12) })

/** Paso 2: confirma con un código de la app; activa y devuelve los códigos de recuperación (una vez). */
profileRoutes.post('/2fa/enable', async (c) => {
  const body = await parseBody(c, codeOnly)
  if (body instanceof Response) return body
  const user = await currentUser(c.get('userId'))
  if (!user?.totpSecret || user.totpEnabledAt) {
    return c.json(apiError('VALIDATION_ERROR', 'Empieza de nuevo la activación'), 400)
  }
  if (!verifyTotp(user.totpSecret, body.code)) {
    return c.json(apiError('CODE_INVALID', 'El código no es correcto. Revisa la hora del móvil.'), 400)
  }
  const recovery = generateRecoveryCodes()
  await db
    .update(users)
    .set({ totpEnabledAt: new Date().toISOString(), totpRecovery: recovery.map((r) => sha256(normalizeRecovery(r))) })
    .where(eq(users.id, user.id))
  return c.json({ ok: true, recoveryCodes: recovery })
})

const disableBody = z.object({ currentPassword: z.string().min(1), code: z.string().trim().min(6).max(12) })

profileRoutes.post('/2fa/disable', async (c) => {
  const body = await parseBody(c, disableBody)
  if (body instanceof Response) return body
  const user = await checkPassword(c.get('userId'), body.currentPassword)
  if (!user) return c.json(wrongPassword(), 401)
  if (!user.totpEnabledAt || !user.totpSecret) return c.json({ ok: true })
  const okTotp = verifyTotp(user.totpSecret, body.code)
  const okRecovery = user.totpRecovery.includes(sha256(normalizeRecovery(body.code)))
  if (!okTotp && !okRecovery) return c.json(apiError('CODE_INVALID', 'El código no es correcto'), 400)
  await db
    .update(users)
    .set({ totpSecret: null, totpEnabledAt: null, totpRecovery: [] })
    .where(eq(users.id, user.id))
  return c.json({ ok: true })
})

const deleteBody = z.object({
  currentPassword: z.string().min(1),
  code: z.string().trim().max(12).optional(),
})

/**
 * Eliminar la cuenta (derecho de supresión): borra el usuario y, en cascada,
 * todos sus datos. Pide la contraseña y, con 2FA activa, también un código.
 */
profileRoutes.delete('/', async (c) => {
  const body = await parseBody(c, deleteBody)
  if (body instanceof Response) return body
  const user = await checkPassword(c.get('userId'), body.currentPassword)
  if (!user) return c.json(wrongPassword(), 401)
  if (user.totpEnabledAt && user.totpSecret) {
    const code = body.code ?? ''
    const ok = verifyTotp(user.totpSecret, code) || user.totpRecovery.includes(sha256(normalizeRecovery(code)))
    if (!ok) return c.json(apiError('CODE_INVALID', 'El código de verificación no es correcto'), 400)
  }
  await db.delete(users).where(eq(users.id, user.id))
  clearAuthCookie(c)
  return c.json({ ok: true })
})
