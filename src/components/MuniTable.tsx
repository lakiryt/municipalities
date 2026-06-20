import { useState } from 'react'
import { evaluate } from '../lang/evaluate'
import type { TypedExpr } from '../lang/expr'
import { items, baseItemEnv } from '../data/municipalities'
import type { ColumnState, ModalState, SortState } from '../types'
import FilterBar from './FilterBar'
import DataTable from './DataTable'
import ColumnModal from './ColumnModal'
import FilterModal from './FilterModal'

type Props = {
  initialColumns: ColumnState[]
  initialFilter?: { expression: string; typed: TypedExpr } | null
  initialSort?: SortState | null
}

function MuniTable({ initialColumns, initialFilter = null, initialSort = null }: Props) {
  const [columns, setColumns] = useState<ColumnState[]>(initialColumns)
  const [nextId, setNextId] = useState(initialColumns.length)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [filterExpr, setFilterExpr] = useState<TypedExpr | null>(initialFilter?.typed ?? null)
  const [filterExpression, setFilterExpression] = useState(initialFilter?.expression ?? '')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortState, setSortState] = useState<SortState | null>(initialSort)

  const editingColumn = modal?.kind === 'edit'
    ? columns.find(c => c.id === modal.id) ?? null
    : null

  const numericColumns = columns.filter(col => col.typed.type === 'n')

  const filteredItems = filterExpr !== null
    ? items.filter(item => evaluate(filterExpr, baseItemEnv(item)) === true)
    : items

  const sortColumn = sortState !== null
    ? numericColumns.find(c => c.id === sortState.columnId) ?? null
    : null

  const displayItems = sortColumn !== null
    ? [...filteredItems].sort((a, b) => {
        const va = evaluate(sortColumn.typed, baseItemEnv(a)) as number
        const vb = evaluate(sortColumn.typed, baseItemEnv(b)) as number
        return sortState!.direction === 'asc' ? va - vb : vb - va
      })
    : filteredItems

  const handleSave = (label: string, expression: string, typed: TypedExpr) => {
    if (modal === null) return
    if (modal.kind === 'add') {
      setColumns(cols => [...cols, { id: nextId, label, expression, typed }])
      setNextId(id => id + 1)
    } else {
      setColumns(cols => cols.map(col =>
        col.id === modal.id ? { ...col, label, expression, typed } : col
      ))
    }
    setModal(null)
  }

  const handleDelete = (id: number) => {
    setColumns(cols => cols.filter(col => col.id !== id))
    setModal(null)
  }

  return (
    <>
      {modal !== null && (
        <ColumnModal
          key={modal.kind === 'edit' ? modal.id : 'new'}
          initialLabel={editingColumn?.label ?? ''}
          initialExpression={editingColumn?.expression ?? ''}
          isNew={modal.kind === 'add'}
          onSave={handleSave}
          onDelete={modal.kind === 'edit' ? () => handleDelete(modal.id) : undefined}
          onClose={() => setModal(null)}
        />
      )}
      {filterOpen && (
        <FilterModal
          initialExpression={filterExpression}
          onApply={(expression, typed) => { setFilterExpression(expression); setFilterExpr(typed); setFilterOpen(false) }}
          onClear={() => { setFilterExpression(''); setFilterExpr(null); setFilterOpen(false) }}
          onClose={() => setFilterOpen(false)}
        />
      )}
      <FilterBar
        numericColumns={numericColumns}
        totalCount={items.length}
        filteredCount={filteredItems.length}
        filterActive={filterExpr !== null}
        sortState={sortState}
        onSortChange={setSortState}
        onFilterClick={() => setFilterOpen(true)}
      />
      <DataTable
        columns={columns}
        displayItems={displayItems}
        onEditColumn={id => setModal({ kind: 'edit', id })}
        onAddColumn={() => setModal({ kind: 'add' })}
      />
    </>
  )
}

export default MuniTable
