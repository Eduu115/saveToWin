/** Claves de dominio en inglés; labels de UI en español. Color = token cN. */

export type ColorToken =
  | 'c1'
  | 'c2'
  | 'c3'
  | 'c4'
  | 'c5'
  | 'c6'
  | 'c7'
  | 'c8'
  | 'c9'
  | 'c10'
  | 'c11'
  | 'c12'

export type FlowType = 'expense' | 'income' | 'savings'

/** Usuario autenticado (sin hash de password en respuestas API). */
export interface User {
  id: number
  email: string
  name: string | null
  /** ISO datetime */
  createdAt: string
  /** Objetivo de ahorro (céntimos). Default 12.000 €. */
  savingsGoalCents: number
}

export interface Account {
  id: number
  userId: number
  key: string
  label: string
  color: ColorToken
  name: string
  /** Banco / entidad (opcional). */
  entity: string | null
  /** Céntimos */
  initialBalance: number
  archived: boolean
}

export interface Card {
  id: number
  userId: number
  accountId: number
  name: string
  archived: boolean
}

export interface Category {
  id: number
  userId: number
  key: string
  label: string
  color: ColorToken
  type: FlowType
  parentId: number | null
  /** Soft-archive; UI oculta archived. */
  archived: boolean
}

export interface Transaction {
  id: number
  userId: number
  /** ISO `YYYY-MM-DD` */
  date: string
  /** Céntimos */
  amount: number
  type: FlowType
  categoryId: number
  accountId: number
  /** Tarjeta opcional (pertenece a accountId). */
  cardId: number | null
  note: string | null
  tags: string[] | null
}

export interface Budget {
  id: number
  userId: number
  categoryId: number
  /** Periodo `YYYY-MM` */
  period: string
  /** Límite en céntimos */
  limit: number
}
