import { useState, useEffect, useMemo } from 'react'
import { evaluate } from '../lang/evaluate'
import type { TypedExpr } from '../lang/expr'
import {
  buildItems, fetchArea, fetchPopulation, fetchDesignations,
  baseItemEnv, areaSources, populationSources,
  type PopulationRecord, type DesignationSets,
} from '../data/municipalities'
import type { ColumnState, ModalState, SortState } from '../types'
import FilterBar from '@/components/FilterBar'
import DataTable from '@/components/DataTable'
import ColumnModal from '@/components/modals/ColumnModal'
import FilterModal from '@/components/modals/FilterModal'
import SortModal from '@/components/modals/SortModal'
import DataModal from '@/components/modals/DataModal'
import SearchModal from '@/components/modals/SearchModal'
import Sidebar from '@/components/Sidebar'

type Props = {
  title?: string
  initialColumns: ColumnState[]
  initialFilter?: { expression: string; typed: TypedExpr } | null
  initialSort?: SortState | null
  initialSearchOpen?: boolean
}

function MuniTable({ title, initialColumns, initialFilter = null, initialSort = null, initialSearchOpen = false }: Props) {
  const [columns, setColumns] = useState<ColumnState[]>(initialColumns)
  const [nextId, setNextId] = useState(initialColumns.length)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [filterExpr, setFilterExpr] = useState<TypedExpr | null>(initialFilter?.typed ?? null)
  const [filterExpression, setFilterExpression] = useState(initialFilter?.expression ?? '')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortState, setSortState] = useState<SortState | null>(initialSort)
  const [sortOpen, setSortOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(initialSearchOpen)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [selectedAreaPath, setSelectedAreaPath] = useState(areaSources[0].path)
  const [selectedPopPath, setSelectedPopPath] = useState(populationSources[0].path)
  const [areaMap, setAreaMap] = useState(new Map<string, number>())
  const [popMap, setPopMap] = useState(new Map<string, PopulationRecord>())
  const [designations, setDesignations] = useState<DesignationSets | undefined>(undefined)

  useEffect(() => {
    const src = areaSources.find(s => s.path === selectedAreaPath)
    if (src) fetchArea(src).then(setAreaMap)
  }, [selectedAreaPath])

  useEffect(() => {
    const src = populationSources.find(s => s.path === selectedPopPath)
    if (src) fetchPopulation(src).then(setPopMap)
  }, [selectedPopPath])

  useEffect(() => { fetchDesignations().then(setDesignations) }, [])

  const activeItems = useMemo(() => buildItems(popMap, areaMap), [popMap, areaMap])

  const editingColumn = modal?.kind === 'edit'
    ? columns.find(c => c.id === modal.id) ?? null
    : null

  const filteredItems = filterExpr !== null
    ? activeItems.filter(item => evaluate(filterExpr, baseItemEnv(item, designations)) === true)
    : activeItems

  const displayItems = sortState !== null
    ? [...filteredItems].sort((a, b) => {
        const va = evaluate(sortState.typed, baseItemEnv(a, designations))
        const vb = evaluate(sortState.typed, baseItemEnv(b, designations))
        const sign = sortState.direction === 'asc' ? 1 : -1
        if (sortState.typed.type === 's') {
          return sign * (va as string).localeCompare(vb as string, 'ja')
        }
        const na = va as number, nb = vb as number
        if (isNaN(na) && isNaN(nb)) return 0
        if (isNaN(na)) return 1
        if (isNaN(nb)) return -1
        return sign * (na - nb)
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
          onSetSort={(expression, typed) => { setSortState({ expression, typed, direction: 'desc' }); setModal(null) }}
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
      {sortOpen && (
        <SortModal
          initialExpression={sortState?.expression ?? ''}
          initialDirection={sortState?.direction ?? 'desc'}
          onApply={(expression, typed, direction) => { setSortState({ expression, typed, direction }); setSortOpen(false) }}
          onClear={() => { setSortState(null); setSortOpen(false) }}
          onClose={() => setSortOpen(false)}
        />
      )}
      {dataOpen && (
        <DataModal
          selectedAreaPath={selectedAreaPath}
          selectedPopPath={selectedPopPath}
          onApply={(areaPath, popPath) => {
            setSelectedAreaPath(areaPath)
            setSelectedPopPath(popPath)
            setDataOpen(false)
          }}
          onClose={() => setDataOpen(false)}
        />
      )}
      {searchOpen && (
        <SearchModal
          onApply={({ filterExpr: fe, filterExpression: fex, sortExpression, sortTyped, sortDirection, columns: cols }) => {
            setFilterExpr(fe)
            setFilterExpression(fex)
            setSortState(sortTyped ? { expression: sortExpression, typed: sortTyped, direction: sortDirection } : null)
            let id = nextId
            setColumns(cols.map(c => ({ ...c, id: id++ })))
            setNextId(id)
            setSearchOpen(false)
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
      {sidebarOpen && (
        <Sidebar
          totalCount={activeItems.length}
          filteredCount={filteredItems.length}
          filterActive={filterExpr !== null}
          sortState={sortState}
          onSortClick={() => { setSortOpen(true); setSidebarOpen(false) }}
          onFilterClick={() => { setFilterOpen(true); setSidebarOpen(false) }}
          onDataClick={() => { setDataOpen(true); setSidebarOpen(false) }}
          onSearchClick={() => { setSearchOpen(true); setSidebarOpen(false) }}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      <FilterBar
        title={title}
        totalCount={activeItems.length}
        filteredCount={filteredItems.length}
        filterActive={filterExpr !== null}
        sortState={sortState}
        onSortClick={() => setSortOpen(true)}
        onFilterClick={() => setFilterOpen(true)}
        onDataClick={() => setDataOpen(true)}
        onSearchClick={() => setSearchOpen(true)}
        onMenuClick={() => setSidebarOpen(true)}
      />
      <DataTable
        columns={columns}
        displayItems={displayItems}
        designations={designations}
        onEditColumn={id => setModal({ kind: 'edit', id })}
        onAddColumn={() => setModal({ kind: 'add' })}
      />
    </>
  )
}

export default MuniTable
