function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

/** Fail-fast de secrets al arrancar. */
export const env = {
  databaseUrl: () => requireEnv('DATABASE_URL'),
  jwtSecret: () => requireEnv('JWT_SECRET'),
  jwtExpiresIn: () => process.env.JWT_EXPIRES_IN ?? '1d',
  port: () => Number(process.env.PORT) || 3000,
  isProd: () => process.env.NODE_ENV === 'production',
  /** Default abierto. `REGISTRATION_OPEN=false` cierra altas nuevas. */
  registrationOpen: () => process.env.REGISTRATION_OPEN !== 'false',
  /**
   * Qué cabecera trae la IP real del cliente (límite de intentos). Solo si hay un
   * proxy delante que la fije: `cloudflare` → CF-Connecting-IP · `proxy` → última
   * entrada de X-Forwarded-For. Sin definir: la IP de la conexión.
   */
  trustedProxy: () => {
    const v = process.env.TRUSTED_PROXY
    return v === 'cloudflare' || v === 'proxy' ? v : null
  },
}

export function assertAuthEnv() {
  env.jwtSecret()
  env.databaseUrl()
}
