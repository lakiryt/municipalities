import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { evaluate } from '../lang/evaluate'
import { parseAndTypeCheck, referencesColumn } from '../lang/expr'
import type { TypedExpr } from '../lang/expr'
import {
  buildItems, fetchArea, fetchPopulation, fetchDesignations,
  baseItemEnv, areaSources, populationSources,
  type PopulationRecord, type DesignationSets,
} from '../data/municipalities'
import type { ColumnState, ColumnRef, ModalState, SortState } from '../types'
import { decodeExploreState, encodeExploreState, nextColumnId, type ExploreState } from '@/lib/exploreState'
import FilterBar from '@/components/FilterBar'
import DataTable from '@/components/DataTable'
import ColumnModal from '@/components/modals/ColumnModal'
import FilterModal from '@/components/modals/FilterModal'
import SortModal from '@/components/modals/SortModal'
import DataModal from '@/components/modals/DataModal'
import SearchModal from '@/components/modals/SearchModal'
import Sidebar from '@/components/Sidebar'
import ConfirmDialog from '@/components/ConfirmDialog'

type Props = {
  title?: string
  initialColumns: ColumnState[]
  initialFilter?: { expression: string; typed: TypedExpr } | null
  initialSort?: SortState | null
  initialSearchOpen?: boolean
}

// Adds or updates a column by stable id, minting a fresh id for a new one.
// Shared by "save column" and "set as sort" (which also needs the resulting
// id to build an `@id` reference).
function upsertColumn(
  cols: ExploreState['columns'], modal: ModalState, label: string, expression: string
): { cols: ExploreState['columns']; id: number } {
  if (modal.kind === 'add') {
    const id = nextColumnId(cols)
    return { cols: [...cols, { id, label, expression }], id }
  }
  const idx = cols.findIndex(c => c.id === modal.id)
  const next = idx === -1 ? cols : cols.map((c, i) => i === idx ? { ...c, label, expression } : c)
  return { cols: next, id: modal.id }
}

function MuniTable({ title, initialColumns, initialFilter = null, initialSort = null, initialSearchOpen = false }: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Columns/filter/sort are derived from the URL when present so that
  // browser back/forward (which only changes searchParams, not the mounted
  // component) replays prior edits. Any edit re-navigates to /explore with
  // the new state, so a page's own `initial*` props are only ever the
  // starting point before the first edit.
  const defaultState: ExploreState = useMemo(() => ({
    columns: initialColumns.map(c => ({ id: c.id, label: c.label, expression: c.expression })),
    filterExpression: initialFilter?.expression ?? '',
    sortExpression: initialSort?.expression ?? '',
    sortDirection: initialSort?.direction ?? 'desc',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])
  const effectiveState = decodeExploreState(searchParams.get('s')) ?? defaultState

  // Columns can never reference `@id` themselves (only filter/sort can), so
  // they're parsed with no column context at all — that's what guarantees
  // the reference graph can't contain a cycle.
  const columns: ColumnState[] = useMemo(() => {
    const out: ColumnState[] = []
    effectiveState.columns.forEach(c => {
      try {
        out.push({ id: c.id, label: c.label, expression: c.expression, typed: parseAndTypeCheck(c.expression) })
      } catch { /* drop invalid column (e.g. hand-edited URL) */ }
    })
    return out
  }, [effectiveState])

  // Includes labels (beyond what type-checking needs) so filter/sort modals
  // can render a human-readable picker for `@id` references.
  const columnRefs: ColumnRef[] = useMemo(
    () => columns.map(c => ({ id: c.id, label: c.label, type: c.typed.type })),
    [columns]
  )
  const colEnv = useMemo(() => columns.map(c => ({ id: c.id, typed: c.typed })), [columns])

  const filterExpr: TypedExpr | null = useMemo(() => {
    if (!effectiveState.filterExpression) return null
    try {
      const t = parseAndTypeCheck(effectiveState.filterExpression, columnRefs)
      return t.type === 'b' ? t : null
    } catch { return null }
  }, [effectiveState, columnRefs])
  const filterExpression = effectiveState.filterExpression

  const sortState: SortState | null = useMemo(() => {
    if (!effectiveState.sortExpression) return null
    try {
      return { expression: effectiveState.sortExpression, typed: parseAndTypeCheck(effectiveState.sortExpression, columnRefs), direction: effectiveState.sortDirection }
    } catch { return null }
  }, [effectiveState, columnRefs])

  const commit = (next: ExploreState) => navigate(`/explore?s=${encodeURIComponent(encodeExploreState(next))}`)

  const [modal, setModal]                 = useState<ModalState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [filterOpen, setFilterOpen]       = useState(false)
  const [sortOpen, setSortOpen]           = useState(false)
  const [dataOpen, setDataOpen]           = useState(false)
  const [searchOpen, setSearchOpen]       = useState(initialSearchOpen)
  const [sidebarOpen, setSidebarOpen]     = useState(false)

  useEffect(() => {
    if (title) document.title = `${title} — 日本の自治体データ`
  }, [title])

  const [selectedAreaPath, setSelectedAreaPath] = useState(areaSources[0].path)
  const [selectedPopPath, setSelectedPopPath]   = useState(populationSources[0].path)
  const [areaMap, setAreaMap]           = useState(new Map<string, number>())
  const [popMap, setPopMap]             = useState(new Map<string, PopulationRecord>())
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
    ? activeItems.filter(item => evaluate(filterExpr, { ...baseItemEnv(item, designations), columns: colEnv }) === true)
    : activeItems

  const displayItems = sortState !== null
    ? [...filteredItems].sort((a, b) => {
        const va = evaluate(sortState.typed, { ...baseItemEnv(a, designations), columns: colEnv })
        const vb = evaluate(sortState.typed, { ...baseItemEnv(b, designations), columns: colEnv })
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

  const handleColumnSave = (label: string, expression: string) => {
    if (modal === null) return
    const { cols } = upsertColumn(effectiveState.columns, modal, label, expression)
    commit({ ...effectiveState, columns: cols })
    setModal(null)
  }

  // Saves the column (same as handleColumnSave) and also points the sort at
  // it by `@id`, so the sort tracks future edits to the column instead of
  // freezing today's expression text.
  const handleSetColumnSort = (label: string, expression: string) => {
    if (modal === null) return
    const { cols, id } = upsertColumn(effectiveState.columns, modal, label, expression)
    commit({ ...effectiveState, columns: cols, sortExpression: `@${id}`, sortDirection: 'desc' })
    setModal(null)
  }

  // Deleting a column never needs to touch filter/sort: their `@id`
  // references (if any) stay pointed at whatever they pointed at before.
  // A reference to the column that was just deleted becomes a normal
  // "column not found" type-check error, same as any other invalid edit.
  const handleColumnDelete = (id: number) => {
    commit({ ...effectiveState, columns: effectiveState.columns.filter(c => c.id !== id) })
    setModal(null)
  }

  const columnUsedIn = (id: number): string[] => {
    const usedIn: string[] = []
    if (filterExpr !== null && referencesColumn(filterExpr, id)) usedIn.push('絞り込み')
    if (sortState !== null && referencesColumn(sortState.typed, id)) usedIn.push('並べ替え')
    return usedIn
  }

  // Deleting a column that filter/sort currently depends on (via `@id`)
  // doesn't fail — it just becomes a type-check error next render — but a
  // silent "your filter stopped working" is bad UX, so confirm first.
  const requestColumnDelete = (id: number) => {
    if (columnUsedIn(id).length > 0) {
      setConfirmDeleteId(id)
    } else {
      handleColumnDelete(id)
    }
  }

  const handleSearchApply: Parameters<typeof SearchModal>[0]['onApply'] = (
    { filterExpression: fex, sortExpression, sortDirection, columns: cols }
  ) => {
    commit({
      columns: cols.map(c => ({ id: c.id, label: c.label, expression: c.expression })),
      filterExpression: fex,
      sortExpression,
      sortDirection,
    })
    setSearchOpen(false)
  }

  return (
    <>
      {modal !== null && (
        <ColumnModal
          key={modal.kind === 'edit' ? modal.id : 'new'}
          initialLabel={editingColumn?.label ?? ''}
          initialExpression={editingColumn?.expression ?? ''}
          isNew={modal.kind === 'add'}
          onSave={handleColumnSave}
          onDelete={modal.kind === 'edit' ? () => requestColumnDelete(modal.id) : undefined}
          onSetSort={handleSetColumnSort}
          onClose={() => setModal(null)}
        />
      )}
      {confirmDeleteId !== null && (
        <ConfirmDialog
          message={`この列は${columnUsedIn(confirmDeleteId).join('・')}で使用されています。\n削除すると、それらの設定が無効になります。\n本当に削除しますか？`}
          onConfirm={() => { handleColumnDelete(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {filterOpen && (
        <FilterModal
          initialExpression={filterExpression}
          columns={columnRefs}
          onApply={(expression) => { commit({ ...effectiveState, filterExpression: expression }); setFilterOpen(false) }}
          onClear={() => { commit({ ...effectiveState, filterExpression: '' }); setFilterOpen(false) }}
          onClose={() => setFilterOpen(false)}
        />
      )}
      {sortOpen && (
        <SortModal
          initialExpression={sortState?.expression ?? ''}
          initialDirection={sortState?.direction ?? 'desc'}
          columns={columnRefs}
          onApply={(expression, _typed, direction) => { commit({ ...effectiveState, sortExpression: expression, sortDirection: direction }); setSortOpen(false) }}
          onClear={() => { commit({ ...effectiveState, sortExpression: '', sortDirection: 'desc' }); setSortOpen(false) }}
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
        <SearchModal onApply={handleSearchApply} onClose={() => setSearchOpen(false)} />
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
