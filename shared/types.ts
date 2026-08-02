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

export type FlowType = 'expense' | 'income'

/** Usuario autenticado (sin hash de password en respuestas API). */
export interface User {
  id: number
  email: string
  name: string | null
  /** ISO datetime */
  createdAt: string
}

export interface Account {
  id: number
  userId: number
  key: string
  label: string
  color: ColorToken
  name: string
  /** Céntimos */
  initialBalance: number
}

export interface Category {
  id: number
  userId: number
  key: string
  label: string
  color: ColorToken
  type: FlowType
  parentId: number | null
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
