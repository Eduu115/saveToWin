import { and, eq } from 'drizzle-orm'
import type { ColorToken } from '@savetowin/shared/types'
import { db } from './client.js'
import { accounts, categories, transactions } from './schema.js'

const CATEGORY_SEED: {
  key: string
  label: string
  color: ColorToken
  type: 'expense' | 'income' | 'savings'
}[] = [
  { key: 'Groceries', label: 'Alimentación', color: 'c1', type: 'expense' },
  { key: 'Dining out', label: 'Restaurantes', color: 'c2', type: 'expense' },
  { key: 'Transport', label: 'Transporte', color: 'c3', type: 'expense' },
  { key: 'Home & bills', label: 'Hogar y facturas', color: 'c8', type: 'expense' },
  { key: 'Health', label: 'Salud', color: 'c9', type: 'expense' },
  { key: 'Clothing', label: 'Prendas', color: 'c7', type: 'expense' },
  { key: 'Leisure', label: 'Ocio', color: 'c4', type: 'expense' },
  { key: 'Travel', label: 'Viajes', color: 'c11', type: 'expense' },
  { key: 'Subscriptions', label: 'Suscripciones', color: 'c5', type: 'expense' },
  {
    key: 'Digital & games',
    label: 'Tecnología, digital y juegos',
    color: 'c6',
    type: 'expense',
  },
  { key: 'Education', label: 'Educación', color: 'c10', type: 'expense' },
  { key: 'Other', label: 'Otros', color: 'c12', type: 'expense' },
  {
    key: 'Savings transfer',
    label: 'Ahorro',
    color: 'c11',
    type: 'savings',
  },
]

const ACCOUNT_SEED: {
  key: string
  label: string
  color: ColorToken
  name: string
}[] = [
  { key: 'Current', label: 'Corriente', color: 'c1', name: 'Cuenta corriente' },
  { key: 'Savings', label: 'Ahorro', color: 'c11', name: 'Cuenta de ahorro' },
  { key: 'Transfer', label: 'Transferencia', color: 'c3', name: 'Transferencias' },
  { key: 'Bizum', label: 'Bizum', color: 'c5', name: 'Bizum' },
  { key: 'Bank card', label: 'Tarjeta bancaria', color: 'c4', name: 'Tarjeta bancaria' },
  { key: 'Prepaid card', label: 'Tarjeta prepago', color: 'c7', name: 'Tarjeta prepago' },
  { key: 'e-cash card', label: 'Monedero', color: 'c6', name: 'Monedero electrónico' },
]

/** Idempotente por `(userId, key)`. Invocar al registrar. */
export async function seedForUser(userId: number) {
  for (const row of CATEGORY_SEED) {
    await db.insert(categories).values({ ...row, userId }).onConflictDoNothing()
  }
  // Usuarios antiguos: asegurar label nuevo de Digital si sigue activa
  await db
    .update(categories)
    .set({ label: 'Tecnología, digital y juegos' })
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.key, 'Digital & games'),
        eq(categories.archived, false),
      ),
    )
  for (const row of ACCOUNT_SEED) {
    await db
      .insert(accounts)
      .values({ ...row, userId, initialBalance: 0 })
      .onConflictDoNothing()
  }
}

/** Aceptación P1.5: céntimos + aislamiento entre usuarios. */
export async function assertSeedIsolation(userA: number, userB: number) {
  await seedForUser(userA)
  await seedForUser(userA) // segunda vez, no duplica

  const catsA = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userA), eq(categories.archived, false)))
  if (catsA.length !== 13) throw new Error(`userA categories=${catsA.length}, expected 13`)

  const accsA = await db.select().from(accounts).where(eq(accounts.userId, userA))
  if (accsA.length !== 7) throw new Error(`userA accounts=${accsA.length}, expected 7`)

  await seedForUser(userB)
  const catsB = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userB), eq(categories.archived, false)))
  if (catsB.length !== 13) throw new Error(`userB categories=${catsB.length}, expected 13`)

  const other = catsA.find((c) => c.key === 'Other')
  const current = accsA.find((a) => a.key === 'Current')
  if (!other || !current) throw new Error('seed incompleto userA')

  const amountCents = 191_345
  const [inserted] = await db
    .insert(transactions)
    .values({
      userId: userA,
      date: '2026-07-01',
      amount: amountCents,
      type: 'expense',
      categoryId: other.id,
      accountId: current.id,
      note: 'seed-cents-check',
      tags: null,
    })
    .returning()

  const [read] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, inserted.id), eq(transactions.userId, userA)))
  if (!read || read.amount !== amountCents) {
    throw new Error(`céntimos incorrectos: expected ${amountCents}, got ${read?.amount}`)
  }

  const leaked = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, inserted.id), eq(transactions.userId, userB)))
  if (leaked.length > 0) throw new Error('userB ve transacción de userA')

  await db.delete(transactions).where(eq(transactions.id, inserted.id))
}
