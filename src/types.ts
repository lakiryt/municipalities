import type { TypedExpr } from './lang/expr'

export type ColumnState = {
  id: number
  label: string
  expression: string
  typed: TypedExpr
}

export type ModalState =
  | { kind: 'edit'; id: number }
  | { kind: 'add' }

export type SortState = {
  columnId: number
  direction: 'asc' | 'desc'
}
