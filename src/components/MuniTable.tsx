import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { evaluate } from '../lang/evaluate'
import { parseAndTypeCheck, referencesColumn } from '../lang/expr'
import type { TypedExpr } from '../lang/expr'
import { buildItems, baseItemEnv } from '../data/municipalities'
import {
  fetchArea, fetchPopulation, fetchRent, fetchMinWages, fetchDesignations, fetchCoastal, fetchMunicipalityCodes,
  officialCodes, selectionFromParams, writeSelectionParams, DATA_KEYS,
  type PopulationMap, type RentMap, type MinWageMap, type DesignationSets, type CodeEntry, type DataSelection,
} from '../data/datasets'
import type { ColumnState, ColumnRef, ModalState, SortState } from '../types'
import { decodeExploreState, encodeExploreState, nextColumnId, type ExploreState } from '@/lib/exploreState'
import { usedData } from '@/lib/usedData'
import AppHeader from '@/components/AppHeader'
import PageHeader from '@/components/PageHeader'
import Toolbar from '@/components/Toolbar'
import SourceNote from '@/components/SourceNote'
import DataTable from '@/components/DataTable'
import MapView from '@/components/MapView'
import ColumnModal from '@/components/modals/ColumnModal'
import FilterModal from '@/components/modals/FilterModal'
import SortModal from '@/components/modals/SortModal'
import DataModal from '@/components/modals/DataModal'
import SearchModal from '@/components/modals/SearchModal'
import Sidebar from '@/components/Sidebar'
import ConfirmDialog from '@/components/ConfirmDialog'

type Props = {
  title?: string
  description?: string
  initialColumns: ColumnState[]
  initialFilter?: { expression: string; typed: TypedExpr } | null
  initialSort?: SortState | null
  initialSearchOpen?: boolean
  // Rankings only make sense for real municipalities — wards of designated
  // cities would double-count against their parent city, and organizational
  // rows (Hokkaido's 振興局, etc.) aren't municipalities at all.
  restrictToOfficial?: boolean
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

// Which column (if any) the current sort is "about": a direct `@id`
// reference, or a column whose expression is (or wraps, e.g. in ROUND) the
// sort expression — ranking pages sort by an expression, not a reference.
function sortedColumnOf(sort: SortState | null, columns: ColumnState[]): ColumnState | null {
  if (!sort) return null
  const ref = sort.expression.match(/^@(\d+)$/)
  if (ref) return columns.find(c => c.id === Number(ref[1])) ?? null
  const norm = (e: string) => e.replace(/\s+/g, '')
  const target = norm(sort.expression)
  return columns.find(c => norm(c.expression) === target) ?? columns.find(c => norm(c.expression).includes(target)) ?? null
}

// A short, human description of the filter for its toolbar chip.
function describeFilter(expression: string): string {
  const pref = expression.match(/^EQ\(\$prefkanji,\s*"([^"]+)"\)$/)
  return pref ? pref[1] : '条件あり'
}

function MuniTable({ title, description, initialColumns, initialFilter = null, initialSort = null, initialSearchOpen = false, restrictToOfficial = false }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

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

  // The map lives in its own `map` query param rather than inside `s=` —
  // unlike editing/sorting/filtering, opening or closing it isn't a change
  // to the explore state itself, so it shouldn't force a page onto /explore
  // or disturb whatever `s=` (or lack of one) that page already has.
  const mapExpression = searchParams.get('map') ?? ''

  // The map only ever references a single column (never a compound
  // expression), so unlike filter/sort it resolves straight to a
  // ColumnState — MapView needs the column itself (for its label/title),
  // not just a typed expression to evaluate.
  const mapState: { expression: string; typed: TypedExpr } | null = useMemo(() => {
    if (!mapExpression) return null
    try {
      const t = parseAndTypeCheck(mapExpression, columnRefs)
      return t.type === 'n' ? { expression: mapExpression, typed: t } : null
    } catch { return null }
  }, [mapExpression, columnRefs])
  const mapColumnId = mapExpression.match(/^@(\d+)$/)?.[1]
  const mapColumn = mapState !== null && mapColumnId !== undefined
    ? columns.find(c => c.id === Number(mapColumnId)) ?? null
    : null

  // データの選択 lives in the URL too (?pop=…&area=…), so it survives reloads
  // and shared links — and carries over when an edit moves a page to /explore.
  const selection: DataSelection = useMemo(() => selectionFromParams(searchParams), [searchParams])
  const setSelection = (next: DataSelection) => setSearchParams(prev => writeSelectionParams(new URLSearchParams(prev), next))
  const exploreUrl = (next: ExploreState, extra: Record<string, string> = {}) => {
    const params = writeSelectionParams(new URLSearchParams(), selection)
    params.set('s', encodeExploreState(next))
    for (const [k, v] of Object.entries(extra)) params.set(k, v)
    return `/explore?${params}`
  }

  const commit = (next: ExploreState) => navigate(exploreUrl(next))

  // Updates just the `map` param on the current URL — same pathname, same
  // `s=` (if any) — so opening/closing the map never leaves the page it was
  // opened from, and closing restores the exact URL (title included) from
  // before it was opened.
  const setMapExpression = (expression: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (expression) next.set('map', expression)
      else next.delete('map')
      return next
    })
  }

  const [modal, setModal]                 = useState<ModalState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [filterOpen, setFilterOpen]       = useState(false)
  const [sortOpen, setSortOpen]           = useState(false)
  const [dataOpen, setDataOpen]           = useState(false)
  const [searchOpen, setSearchOpen]       = useState(initialSearchOpen)
  const [sidebarOpen, setSidebarOpen]     = useState(false)

  useEffect(() => {
    if (!title) return
    document.title = mapColumn
      ? `${mapColumn.label}の地図 — ${title} — 日本の自治体データ`
      : `${title} — 日本の自治体データ`
  }, [title, mapColumn])

  const [areaMap, setAreaMap]           = useState(new Map<string, number>())
  const [popMap, setPopMap]             = useState<PopulationMap>(new Map())
  const [designations, setDesignations] = useState<DesignationSets | undefined>(undefined)
  const [coastal, setCoastal]           = useState<Set<string>>(new Set())
  const [codes, setCodes]               = useState<CodeEntry[]>([])
  const [rentMap, setRentMap]           = useState<RentMap>(new Map())
  const [minWageMap, setMinWageMap]     = useState<MinWageMap>(new Map())

  // The selectable datasets reload whenever データの選択 picks another edition.
  useEffect(() => { fetchPopulation(selection.pop).then(setPopMap) }, [selection.pop])
  useEffect(() => { fetchArea(selection.area).then(setAreaMap) }, [selection.area])
  useEffect(() => { fetchRent(selection.rent).then(setRentMap) }, [selection.rent])
  useEffect(() => { fetchMinWages(selection.minwage).then(setMinWageMap) }, [selection.minwage])

  useEffect(() => { fetchDesignations().then(setDesignations) }, [])
  useEffect(() => { fetchCoastal().then(setCoastal) }, [])
  useEffect(() => { fetchMunicipalityCodes().then(setCodes) }, [])

  // The full, unrestricted base — every downstream view narrows this its
  // own way, but none of them build items from anything smaller than this.
  const activeItems = useMemo(
    () => buildItems(popMap, areaMap, codes, rentMap, minWageMap),
    [popMap, areaMap, codes, rentMap, minWageMap]
  )

  const editingColumn = modal?.kind === 'edit'
    ? columns.find(c => c.id === modal.id) ?? null
    : null

  // Table view: official municipalities only (when asked), then the user's
  // filter, then sort. The counts shown in the toolbar are this view's, not
  // the full base's — a "1918 total" would be a strange thing to show above
  // a table that only ever displays 1747 rows.
  const tableBaseItems = useMemo(
    () => restrictToOfficial ? activeItems.filter(item => officialCodes.has(item.code)) : activeItems,
    [activeItems, restrictToOfficial]
  )

  const filteredItems = filterExpr !== null
    ? tableBaseItems.filter(item => evaluate(filterExpr, { ...baseItemEnv(item, designations, coastal), columns: colEnv }) === true)
    : tableBaseItems

  const displayItems = sortState !== null
    ? [...filteredItems].sort((a, b) => {
        const va = evaluate(sortState.typed, { ...baseItemEnv(a, designations, coastal), columns: colEnv })
        const vb = evaluate(sortState.typed, { ...baseItemEnv(b, designations, coastal), columns: colEnv })
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

  // Map view: the full base plus the same filter — never restricted to
  // official municipalities (a designated-city ward has no 地方公共団体 code
  // of its own but is still a real shape to color) and never sorted, since
  // "order" isn't a concept a map has. (MapView narrows this further still,
  // to whatever codes actually have a drawn path.)
  const mapItems = filterExpr !== null
    ? activeItems.filter(item => evaluate(filterExpr, { ...baseItemEnv(item, designations, coastal), columns: colEnv }) === true)
    : activeItems

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

  // Same idea, but for the map: points the map's `@id` reference at this
  // column, immediately, with no picker. Referencing an existing column
  // as-is never needs to touch `columns`/`s=` at all, so — unlike save/sort,
  // which always graduate a ranking page to /explore — this stays on the
  // current page when nothing about the column actually changed. Only an
  // actual edit (or a brand new column) needs the full commit, since `@id`
  // can't resolve to something that was never saved anywhere.
  const handleSetColumnMap = (label: string, expression: string) => {
    if (modal === null) return
    const unchanged = modal.kind === 'edit' && editingColumn !== null &&
      editingColumn.label === label && editingColumn.expression === expression
    if (unchanged) {
      setMapExpression(`@${modal.id}`)
    } else {
      // An actual edit still has to graduate to /explore (same as save/sort)
      // since `@id` can't resolve to a column that was never saved anywhere
      // — combined into one navigation rather than a commit() followed by a
      // separate setMapExpression(), which would race against each other.
      const { cols, id } = upsertColumn(effectiveState.columns, modal, label, expression)
      const nextState = { ...effectiveState, columns: cols }
      navigate(exploreUrl(nextState, { map: `@${id}` }))
    }
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

  // The map isn't checked here: column headers (the only way into the edit
  // modal) only exist in the table view, and switching to it clears
  // `mapExpression` — so a column being edited is never the one the map
  // currently references.
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

  const sortedColumn = sortedColumnOf(sortState, columns)
  const numericColumns = columnRefs.filter(c => c.type === 'n')

  // 表/地図: the map view is just `map=@id` on the URL. Switching to it
  // colors by the column the rows are ranked by when that's numeric (what
  // the page is "about"), else the first numeric column.
  const handleViewChange = (view: 'table' | 'map') => {
    if (view === 'table') return setMapExpression('')
    const id = sortedColumn && sortedColumn.typed.type === 'n' ? sortedColumn.id : numericColumns[0]?.id
    if (id !== undefined) setMapExpression(`@${id}`)
  }

  // Header sort buttons: the same column again flips the direction; a new
  // one starts high-to-low for numbers, A→Z for text.
  const handleSortColumn = (id: number) => {
    const col = columns.find(c => c.id === id)
    if (!col) return
    const direction = sortedColumn?.id === id
      ? (sortState?.direction === 'desc' ? 'asc' : 'desc')
      : (col.typed.type === 'n' ? 'desc' : 'asc')
    commit({ ...effectiveState, sortExpression: `@${id}`, sortDirection: direction })
  }

  const used = usedData([
    ...columns.map(c => c.expression), filterExpression, sortState?.expression ?? '',
    mapColumn?.expression ?? '',
  ])
  const usedKeys = DATA_KEYS.filter(k => used.selectable.has(k))

  const handleSearchApply: Parameters<typeof SearchModal>[0]['onApply'] = (
    { filterExpression: fex, sortExpression, sortDirection, columns: cols }
  ) => {
    // commit() (via navigate) replaces the whole URL with just `?s=...`,
    // which already drops any `map=` param along with it — a fresh search
    // replaces the whole column set, so any `@id` the map was pointing at
    // wouldn't have been meaningful to keep anyway.
    commit({
      columns: cols.map(c => ({ id: c.id, label: c.label, expression: c.expression })),
      filterExpression: fex,
      sortExpression,
      sortDirection,
    })
    setSearchOpen(false)
  }

  const toolbar = (
    <Toolbar
      view={mapColumn ? 'map' : 'table'}
      mapAvailable={numericColumns.length > 0}
      onViewChange={handleViewChange}
      sortLabel={sortState ? (sortedColumn?.label ?? sortState.expression) : null}
      sortDirection={sortState?.direction ?? 'desc'}
      filterLabel={filterExpr !== null ? describeFilter(filterExpression) : null}
      shownCount={filteredItems.length}
      totalCount={tableBaseItems.length}
      onSortClick={() => setSortOpen(true)}
      onFilterClick={() => setFilterOpen(true)}
    />
  )

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
          onSetMap={handleSetColumnMap}
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
          selection={selection}
          onApply={next => {
            setSelection(next)
            setDataOpen(false)
          }}
          onClose={() => setDataOpen(false)}
        />
      )}
      {searchOpen && (
        <SearchModal onApply={handleSearchApply} onClose={() => setSearchOpen(false)} />
      )}
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <AppHeader onMenuClick={() => setSidebarOpen(true)} />
      {mapColumn ? (
        // Map view: fills the screen below the header — no page scroll, so
        // drags and pinches always go to the map.
        <div className="fixed inset-x-0 top-11 bottom-0 flex flex-col">
          <PageHeader title={title} used={usedKeys} selection={selection} onDataClick={() => setDataOpen(true)} compact />
          {toolbar}
          <div className="flex-1 min-h-0">
            <MapView
              column={mapColumn}
              columnOptions={numericColumns}
              onSelectColumn={id => setMapExpression(`@${id}`)}
              displayItems={mapItems}
              designations={designations}
              coastal={coastal}
              fitToItems={filterExpr !== null}
            />
          </div>
          <SourceNote used={usedKeys} selection={selection} designations={used.designations} map compact />
        </div>
      ) : (
        // Table view: one scroll container for both axes, so the toolbar and
        // the table header stick to the top and the rank/name columns to the
        // left. The page header, toolbar and source note are pinned to the
        // left edge (100cqw = the container's visible width) so they don't
        // slide away when a wide table scrolls sideways.
        <main className="fixed inset-x-0 top-11 bottom-0 overflow-auto [container-type:inline-size]">
          <div className="sticky left-0 w-[100cqw]">
            <PageHeader title={title} description={description} used={usedKeys} selection={selection} onDataClick={() => setDataOpen(true)} />
          </div>
          <div className="sticky top-0 left-0 z-40 w-[100cqw]">{toolbar}</div>
          <DataTable
            columns={columns}
            displayItems={displayItems}
            designations={designations}
            coastal={coastal}
            sortedColumnId={sortedColumn?.id ?? null}
            sortDirection={sortState?.direction ?? 'desc'}
            onEditColumn={id => setModal({ kind: 'edit', id })}
            onAddColumn={() => setModal({ kind: 'add' })}
            onSortColumn={handleSortColumn}
          />
          <div className="sticky left-0 w-[100cqw]">
            <SourceNote used={usedKeys} selection={selection} designations={used.designations} map={used.coastal} />
          </div>
        </main>
      )}
    </>
  )
}

export default MuniTable
