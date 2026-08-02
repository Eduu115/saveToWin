import { eq } from 'drizzle-orm'
import type { ColorToken } from '@savetowin/shared/types'
import { db } from './client.js'
import { accounts, categories, transactions } from './schema.js'

const CATEGORY_SEED: {
  key: string
  label: string
  color: ColorToken
  type: 'expense' | 'income'
}[] = [
  { key: 'Groceries', label: 'Alimentación', color: 'c1', type: 'expense' },
  { key: 'Dining out', label: 'Restaurantes', color: 'c2', type: 'expense' },
  { key: 'Transport', label: 'Transporte', color: 'c3', type: 'expense' },
  { key: 'Tech', label: 'Tecnología', color: 'c4', type: 'expense' },
  { key: 'Subscriptions', label: 'Suscripciones', color: 'c5', type: 'expense' },
  { key: 'Digital & games', label: 'Digital y juegos', color: 'c6', type: 'expense' },
  { key: 'Shopping', label: 'Compras', color: 'c7', type: 'expense' },
  { key: 'Home & bills', label: 'Hogar y facturas', color: 'c8', type: 'expense' },
  { key: 'Health', label: 'Salud', color: 'c9', type: 'expense' },
  { key: 'Education', label: 'Educación', color: 'c10', type: 'expense' },
  { key: 'Travel', label: 'Viajes', color: 'c11', type: 'expense' },
  { key: 'Other', label: 'Otros', color: 'c12', type: 'expense' },
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

/** Idempotente por `key` única. */
export function seed() {
  for (const row of CATEGORY_SEED) {
    db.insert(categories).values(row).onConflictDoNothing().run()
  }
  for (const row of ACCOUNT_SEED) {
    db.insert(accounts)
      .values({ ...row, initialBalance: 0 })
      .onConflictDoNothing()
      .run()
  }
}

/** Comprueba insert/select de céntimos (aceptación P1.5). */
export function assertCentsRoundTrip(amountCents: number) {
  const category = db.select().from(categories).where(eq(categories.key, 'Other')).get()
  const account = db.select().from(accounts).where(eq(accounts.key, 'Current')).get()
  if (!category || !account) throw new Error('seed incompleto')

  const inserted = db
    .insert(transactions)
    .values({
      date: '2026-07-01',
      amount: amountCents,
      type: 'expense',
      categoryId: category.id,
      accountId: account.id,
      note: 'seed-cents-check',
      tags: null,
    })
    .returning()
    .get()

  const read = db.select().from(transactions).where(eq(transactions.id, inserted.id)).get()
  if (!read || read.amount !== amountCents) {
    throw new Error(`céntimos incorrectos: expected ${amountCents}, got ${read?.amount}`)
  }
  db.delete(transactions).where(eq(transactions.id, inserted.id)).run()
}
