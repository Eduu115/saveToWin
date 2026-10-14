import nodemailer, { type Transporter } from 'nodemailer'
import { env } from './env.js'

/**
 * Correo saliente por SMTP (cualquier proveedor: Gmail con contraseña de
 * aplicación, Brevo, Resend SMTP, el de tu dominio…).
 * Variables: SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, MAIL_FROM.
 * Sin SMTP_HOST: en desarrollo se imprime en consola; en producción no se envía.
 */

export class MailNotConfiguredError extends Error {}

export const mailConfigured = () => Boolean(process.env.SMTP_HOST) || !env.isProd()

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
  return transporter
}

export async function sendMail(to: string, subject: string, text: string) {
  const t = getTransporter()
  if (!t) {
    if (env.isProd()) throw new MailNotConfiguredError('SMTP no configurado')
    console.log(`\n[mail · dev] Para: ${to}\nAsunto: ${subject}\n\n${text}\n`)
    return
  }
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  })
}

/** «an***@gmail.com» para decir a dónde se envió sin mostrar el email entero. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`
}
