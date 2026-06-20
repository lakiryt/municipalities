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

  const sortTyped = parseAndTypeCheck(config.sortExpression)
  const initialSort: SortState = {
    expression: config.sortExpression,
    typed: sortTyped,
    direction: config.sortDirection,
  }

  const initialFilter = config.filterExpression
    ? { expression: config.filterExpression, typed: parseAndTypeCheck(config.filterExpression) }
    : null

  return (
    <>
      <title>{config.title}</title>
      <MuniTable
        title={config.title}
        initialColumns={columns}
        initialFilter={initialFilter}
        initialSort={initialSort}
      />
    </>
  )
}

export default RankingPage
