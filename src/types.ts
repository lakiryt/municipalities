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
  expression: string
  typed: TypedExpr
  direction: 'asc' | 'desc'
}

export type RankingConfig = {
  title: string
  columns: { label: string; expression: string }[]
  filterExpression?: string
  sortExpression: string
  sortDirection: 'asc' | 'desc'
}
