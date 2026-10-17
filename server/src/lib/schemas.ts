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
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1, 'El nombre es obligatorio').max(40, 'Máximo 40 caracteres'),
  color: colorTokenSchema,
  type: flowTypeSchema,
  parentId: z.number().int().positive().nullable().optional(),
})

/** Sin `key` ni `type`: la clave la usa la lógica y el tipo debe casar con sus movimientos. */
export const categoryPatchSchema = z.object({
  label: categoryCreateSchema.shape.label.optional(),
  color: colorTokenSchema.optional(),
  archived: z.boolean().optional(),
})

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

/** `1,2,3` → [1, 2, 3] */
const idListSchema = z
  .string()
  .regex(/^\d+(,\d+)*$/, 'lista de ids separada por comas')
  .transform((s) => s.split(',').map(Number))

export const transactionListQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  accountId: z.coerce.number().int().positive().optional(),
  categoryIds: idListSchema.optional(),
  accountIds: idListSchema.optional(),
  type: flowTypeSchema.optional(),
  /** Busca en la descripción y en el nombre de la categoría. */
  q: z.string().trim().max(100).optional(),
  /** Céntimos */
  minAmount: z.coerce.number().int().min(0).optional(),
  maxAmount: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/** Límite mensual desde `period` en adelante; `limit: 0` lo quita desde ese mes. */
export const budgetSetSchema = z.object({
  categoryId: z.number().int().positive(),
  period: periodSchema,
  limit: centsSchema.nonnegative(),
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
})

export const registerConfirmSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().regex(/^\d{6}$/, 'El código son 6 dígitos'),
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
