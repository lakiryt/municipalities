import type { TypedExpr, ColumnTypeInfo } from './lang/expr'

export type ColumnState = {
  id: number
  label: string
  expression: string
  typed: TypedExpr
}

// Enough to both type-check `@id` references (ColumnTypeInfo) and render a
// human-readable picker for them (label) in the filter/sort UI.
export type ColumnRef = ColumnTypeInfo & { label: string }

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
  description?: string
  columns: { label: string; expression: string }[]
  filterExpression?: string
  sortExpression: string
  sortDirection: 'asc' | 'desc'
}
