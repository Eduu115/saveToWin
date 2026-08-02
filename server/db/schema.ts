import { sql } from 'drizzle-orm'
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

export const flowTypeEnum = pgEnum('flow_type', ['expense', 'income'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
})

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    color: text('color').notNull(),
    name: text('name').notNull(),
    /** Céntimos */
    initialBalance: integer('initial_balance').notNull().default(0),
  },
  (t) => [uniqueIndex('accounts_user_key').on(t.userId, t.key)],
)

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    color: text('color').notNull(),
    type: flowTypeEnum('type').notNull(),
    parentId: integer('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [uniqueIndex('categories_user_key').on(t.userId, t.key)],
)

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** ISO `YYYY-MM-DD` */
  date: text('date').notNull(),
  /** Céntimos */
  amount: integer('amount').notNull(),
  type: flowTypeEnum('type').notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'restrict' }),
  note: text('note'),
  tags: jsonb('tags').$type<string[] | null>(),
})

export const budgets = pgTable(
  'budgets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    /** `YYYY-MM` */
    period: text('period').notNull(),
    /** Céntimos */
    limit: integer('limit_cents').notNull(),
  },
  (t) => [uniqueIndex('budgets_user_category_period').on(t.userId, t.categoryId, t.period)],
)
