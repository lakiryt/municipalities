import { parseAndTypeCheck } from '../lang/expr'
import type { RankingConfig, ColumnState, SortState } from '../types'
import MuniTable from './MuniTable'

type Props = { config: RankingConfig }

function RankingPage({ config }: Props) {
  const columns: ColumnState[] = config.columns.map((col, i) => ({
    id: i,
    label: col.label,
    expression: col.expression,
    typed: parseAndTypeCheck(col.expression),
  }))

  const sortCol = columns.find(c => c.expression === config.sortExpression)
  const initialSort: SortState | null = sortCol
    ? { columnId: sortCol.id, direction: config.sortDirection }
    : null

  const initialFilter = config.filterExpression
    ? { expression: config.filterExpression, typed: parseAndTypeCheck(config.filterExpression) }
    : null

  return (
    <>
      <h1 className="text-xl font-bold px-4 py-3">{config.title}</h1>
      <MuniTable
        initialColumns={columns}
        initialFilter={initialFilter}
        initialSort={initialSort}
      />
    </>
  )
}

export default RankingPage
