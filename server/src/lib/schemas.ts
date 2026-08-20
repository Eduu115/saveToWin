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
  key: z.string().min(1),
  label: z.string().min(1),
  color: colorTokenSchema,
  name: z.string().min(1),
  initialBalance: centsSchema.optional().default(0),
})

export const accountPatchSchema = accountCreateSchema.partial()

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
