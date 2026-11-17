import type { TypedExpr, ColumnInfo, Closed } from './lang/expr'

export type ColumnState = {
  id: number
  label: string
  expression: string
  // Closed: a column's expression can't refer to another column.
  typed: TypedExpr<Closed>
}

// Enough to both type-check `@id` references (ColumnInfo) and render a
// human-readable picker for them (label) in the filter/sort UI.
export type ColumnRef = ColumnInfo & { label: string }

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
  // Shown in this order. `id` (default: the position) is what `@id`
  // references in URLs point at — keep it fixed when reordering, so shared
  // links (e.g. ?map=@4) keep pointing at the same column.
  columns: { id?: number; label: string; expression: string }[]
  filterExpression?: string
  sortExpression: string
  sortDirection: 'asc' | 'desc'
}
