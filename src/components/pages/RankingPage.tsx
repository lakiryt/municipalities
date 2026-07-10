import { parseAndTypeCheck } from '@/lang/expr'
import type { RankingConfig, ColumnState, SortState } from '@/types'
import MuniTable from '@/components/MuniTable'
import Canonical from '@/components/Canonical'

type Props = { config: RankingConfig }

function RankingPage({ config }: Props) {
  const columns: ColumnState[] = config.columns.map((col, i) => ({
    id: i,
    label: col.label,
    expression: col.expression,
    typed: parseAndTypeCheck(col.expression),
  }))

  const initialSort: SortState | null = config.sortExpression
    ? { expression: config.sortExpression, typed: parseAndTypeCheck(config.sortExpression), direction: config.sortDirection }
    : null

  const initialFilter = config.filterExpression
    ? { expression: config.filterExpression, typed: parseAndTypeCheck(config.filterExpression) }
    : null

  return (
    <>
      <Canonical />
      {config.description && <meta name="description" content={config.description} />}
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
