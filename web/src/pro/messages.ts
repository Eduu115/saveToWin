import type { MessageKey } from '../i18n/t'

/**
 * Textos del núcleo que cambian en la versión alojada (savetowin.app).
 * El open source habla de «tu servidor / self-hosted»; aquí el servidor es nuestro.
 */
const messages: Partial<Record<MessageKey, string>> = {
  'auth.welcomeHint': 'Tus números, en un servidor dedicado. No los cedemos a nadie.',
  'auth.slogan.body':
    'Tus movimientos y tus categorías en un servidor dedicado e independiente. Sin publicidad y sin ceder tus datos a terceros.',
  'auth.brand.stat1.value': 'Privado',
  'auth.brand.stat1.label': 'servidor dedicado e independiente',
  'auth.brand.stat2.value': 'Sin anuncios',
  'auth.brand.stat2.label': 'ni venta de datos',
  'auth.selfHosted': 'Servidor dedicado · tus datos no se ceden a terceros',
  'auth.registrationClosed': 'El registro está cerrado por ahora.',
  'import.pageHint': 'CSV · se procesa en nuestro servidor, sin terceros',
  'profile.noMail': 'El envío de correo no está disponible ahora mismo; prueba más tarde a cambiar tu email o tu contraseña.',
}

export default messages
