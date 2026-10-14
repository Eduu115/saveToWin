/**
 * Asignar plan a mano (hasta que haya cobro):
 *   node dist/pro/set-plan.js <email> <free|premium> [YYYY-MM-DD]
 * Sin fecha = premium indefinido.
 */
import { eq } from 'drizzle-orm'
import { closeDb, db } from '../db/client.js'
import { users } from '../db/schema.js'
import { ensureProSchema, setPlan, type Plan } from './plans.js'

const [email, plan, until] = process.argv.slice(2)
if (!email || (plan !== 'free' && plan !== 'premium') || (until && !/^\d{4}-\d{2}-\d{2}$/.test(until))) {
  console.error('uso: set-plan <email> <free|premium> [YYYY-MM-DD]')
  process.exit(1)
}
await ensureProSchema()
const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
if (!user) {
  console.error(`no existe el usuario ${email}`)
  process.exit(1)
}
await setPlan(user.id, plan as Plan, until ?? null)
console.log(`${email} → ${plan}${until ? ` hasta ${until}` : ''}`)
await closeDb()
