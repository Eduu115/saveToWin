import { z } from 'zod'

export const colorTokenSchema = z.enum([
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
  'c7',
  'c8',
  'c9',
  'c10',
  'c11',
  'c12',
])

export const flowTypeSchema = z.enum(['expense', 'income', 'savings'])

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha ISO YYYY-MM-DD')

export const periodSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'periodo YYYY-MM')

export const centsSchema = z.number().int()

export const accountCreateSchema = z.object({
  name: z.string().min(1),
  entity: z.string().min(1).nullable().optional(),
  key: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  color: colorTokenSchema.optional().default('c1'),
  initialBalance: centsSchema.optional().default(0),
})

export const accountPatchSchema = z.object({
  name: z.string().min(1).optional(),
  entity: z.string().min(1).nullable().optional(),
  label: z.string().min(1).optional(),
  color: colorTokenSchema.optional(),
  initialBalance: centsSchema.optional(),
  archived: z.boolean().optional(),
})

export const cardCreateSchema = z.object({
  accountId: z.number().int().positive(),
  name: z.string().min(1),
})

export const cardPatchSchema = z.object({
  name: z.string().min(1).optional(),
  archived: z.boolean().optional(),
})

export const categoryCreateSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  color: colorTokenSchema,
  type: flowTypeSchema,
  parentId: z.number().int().positive().nullable().optional(),
})

export const categoryPatchSchema = categoryCreateSchema.partial()

export const transactionCreateSchema = z.object({
  date: isoDateSchema,
  amount: centsSchema,
  type: flowTypeSchema,
  categoryId: z.number().int().positive(),
  accountId: z.number().int().positive(),
  cardId: z.number().int().positive().nullable().optional(),
  note: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
})

export const transactionBatchSchema = z.object({
  items: z.array(transactionCreateSchema).min(1).max(2000),
  skipDuplicates: z.boolean().optional().default(true),
})

export const transactionPatchSchema = transactionCreateSchema.partial()

export const transactionListQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  accountId: z.coerce.number().int().positive().optional(),
  type: flowTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export const budgetCreateSchema = z.object({
  categoryId: z.number().int().positive(),
  period: periodSchema,
  limit: centsSchema,
})

export const budgetPatchSchema = budgetCreateSchema.partial()

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const updateMeSchema = z.object({
  savingsGoalCents: centsSchema.positive().optional(),
  name: z.string().min(1).nullable().optional(),
})

export const subscriptionRecurrenceSchema = z.enum([
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
])

export const subscriptionCustomUnitSchema = z.enum(['weeks', 'months', 'years'])

const subscriptionFields = {
  categoryId: z.number().int().positive(),
  accountId: z.number().int().positive(),
  cardId: z.number().int().positive().nullable().optional(),
  amount: centsSchema.positive(),
  recurrence: subscriptionRecurrenceSchema,
  customEvery: z.number().int().positive().nullable().optional(),
  customUnit: subscriptionCustomUnitSchema.nullable().optional(),
  /** Primera cargo / próxima fecha (`YYYY-MM-DD`). */
  nextDate: isoDateSchema,
  note: z.string().nullable().optional(),
}

export const subscriptionCreateSchema = z
  .object(subscriptionFields)
  .superRefine((val, ctx) => {
    if (val.recurrence === 'custom') {
      if (val.customEvery == null || val.customEvery < 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'customEvery obligatorio si recurrence=custom',
          path: ['customEvery'],
        })
      }
      if (!val.customUnit) {
        ctx.addIssue({
          code: 'custom',
          message: 'customUnit obligatorio si recurrence=custom',
          path: ['customUnit'],
        })
      }
    }
  })

export const subscriptionPatchSchema = z
  .object({
    categoryId: z.number().int().positive().optional(),
    accountId: z.number().int().positive().optional(),
    cardId: z.number().int().positive().nullable().optional(),
    amount: centsSchema.positive().optional(),
    recurrence: subscriptionRecurrenceSchema.optional(),
    customEvery: z.number().int().positive().nullable().optional(),
    customUnit: subscriptionCustomUnitSchema.nullable().optional(),
    nextDate: isoDateSchema.optional(),
    note: z.string().nullable().optional(),
    status: z.enum(['active', 'cancelled']).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.recurrence === 'custom') {
      if (val.customEvery == null || val.customEvery < 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'customEvery obligatorio si recurrence=custom',
          path: ['customEvery'],
        })
      }
      if (!val.customUnit) {
        ctx.addIssue({
          code: 'custom',
          message: 'customUnit obligatorio si recurrence=custom',
          path: ['customUnit'],
        })
      }
    }
  })
