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
}

export function assertAuthEnv() {
  env.jwtSecret()
  env.databaseUrl()
}
