import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  name: text('name').notNull(),
  /** Céntimos */
  initialBalance: integer('initial_balance').notNull().default(0),
})

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  type: text('type', { enum: ['expense', 'income'] }).notNull(),
  parentId: integer('parent_id').references((): AnySQLiteColumn => categories.id, {
    onDelete: 'set null',
  }),
})

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** ISO `YYYY-MM-DD` */
  date: text('date').notNull(),
  /** Céntimos */
  amount: integer('amount').notNull(),
  type: text('type', { enum: ['expense', 'income'] }).notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'restrict' }),
  note: text('note'),
  tags: text('tags', { mode: 'json' }).$type<string[] | null>(),
})

export const budgets = sqliteTable(
  'budgets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    /** `YYYY-MM` */
    period: text('period').notNull(),
    /** Céntimos */
    limit: integer('limit_cents').notNull(),
  },
  (t) => [uniqueIndex('budgets_category_period').on(t.categoryId, t.period)],
)
