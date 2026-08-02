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
