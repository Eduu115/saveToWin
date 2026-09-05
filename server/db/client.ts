import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from './schema.js'

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  return url
}

const url = requireDatabaseUrl()

/**
 * PG: un valor nuevo de enum no se puede usar en la misma transacción que ALTER TYPE.
 * Drizzle migrate() envuelve todo en un BEGIN → hay que añadir 'savings' fuera, autocommit.
 */
const ddl = postgres(url, { max: 1 })
try {
  await ddl.unsafe(`ALTER TYPE "public"."flow_type" ADD VALUE IF NOT EXISTS 'savings'`)
} catch (err) {
  // Si el tipo aún no existe (DB virgen), la migración 0000 lo crea; ignorar.
  const msg = err instanceof Error ? err.message : String(err)
  if (!msg.includes('does not exist')) throw err
} finally {
  await ddl.end({ timeout: 5 })
}

const client = postgres(url, { max: 10 })
export const db = drizzle(client, { schema })

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
await migrate(db, { migrationsFolder })

export function getDatabaseUrl(): string {
  return url
}

export async function closeDb() {
  await client.end({ timeout: 5 })
}
