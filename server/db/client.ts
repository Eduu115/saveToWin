// ponytail: stub hasta P1.4 (client Postgres real + migrate)
export function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? ''
}
