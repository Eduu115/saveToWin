import { advanceSubscriptionDate } from '@savetowin/shared/subscription'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { subscriptions, transactions } from '../../db/schema.js'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Materializa movimientos vencidos de suscripciones activas hasta hoy.
 * ponytail: sin cron — se llama al listar/crear suscripciones; techo = O(n*periodos).
 */
export async function ensureSubscriptionOccurrences(
  userId: number,
  until: string = todayIso(),
): Promise<number> {
  const active = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))

  let inserted = 0
  for (const sub of active) {
    let next = sub.nextDate
    let safety = 0
    while (next <= until && safety < 500) {
      safety += 1
      try {
        await db.insert(transactions).values({
          userId,
          date: next,
          amount: sub.amount,
          type: 'expense',
          categoryId: sub.categoryId,
          accountId: sub.accountId,
          cardId: sub.cardId,
          subscriptionId: sub.id,
          note: sub.note,
          tags: null,
        })
        inserted += 1
      } catch {
        // unique (subscription_id, date) → ya materializado
      }
      next = advanceSubscriptionDate(
        next,
        sub.recurrence,
        sub.customEvery,
        sub.customUnit,
      )
    }
    if (next !== sub.nextDate) {
      await db
        .update(subscriptions)
        .set({ nextDate: next })
        .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.userId, userId)))
    }
  }
  return inserted
}
