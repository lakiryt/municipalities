import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { evaluate } from '../lang/evaluate'
import { parseAndTypeCheck } from '../lang/expr'
import type { TypedExpr } from '../lang/expr'
import { baseItemEnv, type BaseItem } from '../data/municipalities'
import type { Env } from '../lang/evaluate'
import { selectionFromParams, writeSelectionParams, DATA_KEYS, type DataSelection, type DataKey } from '../data/datasets'
import { useMunicipalityData } from '../data/useMunicipalityData'
import type { ColumnState, ColumnRef, ModalState, SortState } from '../types'
import { decodeExploreState, encodeExploreState, nextColumnId, type ExploreState } from '@/lib/exploreState'
import { usedData } from '@/lib/usedData'
import { describeFilter } from '@/lib/filterLabel'
import { pageTitle } from '@/lib/brand'
import AppHeader from '@/components/AppHeader'
import PageHeader from '@/components/PageHeader'
import Toolbar from '@/components/Toolbar'
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

function MuniTable({ title, initialColumns, initialFilter = null, initialSort = null, initialSearchOpen = false }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Columns/filter/sort are derived from the URL when present so that
  // browser back/forward (which only changes searchParams, not the mounted
  // component) replays prior edits. Any edit re-navigates to /explore with
  // the new state, so a page's own `initial*` props are only ever the
  // starting point before the first edit.
  const startKey = JSON.stringify([initialColumns.map(c => [c.id, c.label, c.expression]), initialFilter?.expression, initialSort?.expression, initialSort?.direction])
  const defaultState: ExploreState = useMemo(() => ({
    columns: initialColumns.map(c => ({ id: c.id, label: c.label, expression: c.expression })),
    filterExpression: initialFilter?.expression ?? '',
    sortExpression: initialSort?.expression ?? '',
    sortDirection: initialSort?.direction ?? 'desc',
    // Recomputed only when the page's starting point itself changes (e.g. a
    // ranking whose column labels name the period データの選択 compares),
    // not on every render of a freshly mapped array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [startKey])
  const effectiveState = decodeExploreState(searchParams.get('s')) ?? defaultState

  // Navigations render in a transition, so for a moment after an edit the
  // rendered state lags behind the URL. Every edit builds on the URL — the
  // latest state — so a quick second edit (sort, then delete a column) never
  // undoes the first or misses what it changed.
  const latestState = (): ExploreState =>
    decodeExploreState(new URLSearchParams(window.location.search).get('s')) ?? defaultState

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
  // データの選択: open (optionally focused on one dataset, from its chip) or closed.
  const [dataModal, setDataModal] = useState<{ focus?: DataKey } | null>(null)
  const [searchOpen, setSearchOpen]       = useState(initialSearchOpen)
  const [sidebarOpen, setSidebarOpen]     = useState(false)

  useEffect(() => {
    if (!title) return
    document.title = mapColumn
      ? pageTitle(`${mapColumn.label}の地図`, title)
      : pageTitle(title)
  }, [title, mapColumn])

  // The data the columns, filter, sort and map draw on: shown as chips and in
  // 出典, and 人口増減 is only fetched when something uses it.
  const used = usedData([
    ...columns.map(c => c.expression), filterExpression, sortState?.expression ?? '',
    mapColumn?.expression ?? '',
  ])
  const usedKeys = DATA_KEYS.filter(k => used.selectable.has(k))

  const { items: activeItems, designations, coastal } = useMunicipalityData(selection, used.selectable.has('change'))

  const editingColumn = modal?.kind === 'edit'
    ? columns.find(c => c.id === modal.id) ?? null
    : null

  // Table rows: every municipality and designated-city ward (each has its
  // own figures and page); not prefectures or grouping rows (郡・振興局).
  // Which of them to show is up to the filter — rankings start with
  // &official so a city and its wards aren't counted twice, but that's a
  // visible, removable condition. The toolbar counts are of these rows.
  const tableBaseItems = useMemo(
    () => activeItems.filter(item => item.kind !== '' && item.kind !== '都道府県'),
    [activeItems]
  )

  // Each municipality's variables (incl. ~15 derived ones) are computed once
  // per data change and shared by the filter, the sort and the table cells —
  // recomputing them inside the sort comparator made every sort ~1s.
  const envs = useMemo(
    () => new Map(activeItems.map(item => [item.code, baseItemEnv(item, designations, coastal)])),
    [activeItems, designations, coastal]
  )
  const envOf = useMemo(
    () => (item: BaseItem): Env => ({ ...envs.get(item.code)!, columns: colEnv }),
    [envs, colEnv]
  )

  const filteredItems = useMemo(
    () => filterExpr !== null ? tableBaseItems.filter(item => evaluate(filterExpr, envOf(item)) === true) : tableBaseItems,
    [tableBaseItems, filterExpr, envOf]
  )

  // Sort key evaluated once per row, then a plain sort on the keys.
  const displayItems = useMemo(() => {
    if (sortState === null) return filteredItems
    const sign = sortState.direction === 'asc' ? 1 : -1
    const keyed = filteredItems.map(item => ({ item, v: evaluate(sortState.typed, envOf(item)) }))
    keyed.sort((a, b) => {
      if (sortState.typed.type === 's') return sign * (a.v as string).localeCompare(b.v as string, 'ja')
      const na = a.v as number, nb = b.v as number
      if (isNaN(na) && isNaN(nb)) return 0
      if (isNaN(na)) return 1
      if (isNaN(nb)) return -1
      return sign * (na - nb)
    })
    return keyed.map(k => k.item)
  }, [filteredItems, sortState, envOf])

  // Map view: the full base plus the same filter — never restricted to
  // official municipalities (a designated-city ward has no 地方公共団体 code
  // of its own but is still a real shape to color) and never sorted, since
  // "order" isn't a concept a map has. (MapView narrows this further still,
  // to whatever codes actually have a drawn path.)
  const mapItems = useMemo(
    () => filterExpr !== null ? activeItems.filter(item => evaluate(filterExpr, envOf(item)) === true) : activeItems,
    [activeItems, filterExpr, envOf]
  )

  const handleColumnSave = (label: string, expression: string) => {
    if (modal === null) return
    const { cols } = upsertColumn(latestState().columns, modal, label, expression)
    commit({ ...latestState(), columns: cols })
    setModal(null)
  }

  // Saves the column (same as handleColumnSave) and also points the sort at
  // it by `@id`, so the sort tracks future edits to the column instead of
  // freezing today's expression text.
  const handleSetColumnSort = (label: string, expression: string) => {
    if (modal === null) return
    const { cols, id } = upsertColumn(latestState().columns, modal, label, expression)
    commit({ ...latestState(), columns: cols, sortExpression: `@${id}`, sortDirection: 'desc' })
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
      const { cols, id } = upsertColumn(latestState().columns, modal, label, expression)
      const nextState = { ...latestState(), columns: cols }
      navigate(exploreUrl(nextState, { map: `@${id}` }))
    }
    setModal(null)
  }

  // Deleting a column never needs to touch filter/sort: their `@id`
  // references (if any) stay pointed at whatever they pointed at before.
  // A reference to the column that was just deleted becomes a normal
  // "column not found" type-check error, same as any other invalid edit.
  const handleColumnDelete = (id: number) => {
    const state = latestState()
    commit({ ...state, columns: state.columns.filter(c => c.id !== id) })
    setModal(null)
  }

  // The map isn't checked here: column headers (the only way into the edit
  // modal) only exist in the table view, and switching to it clears
  // `mapExpression` — so a column being edited is never the one the map
  // currently references.
  // `@id` is the only way an expression refers to a column, so a textual
  // check on the latest filter/sort is exact.
  const columnUsedIn = (id: number): string[] => {
    const { filterExpression: f, sortExpression: so } = latestState()
    const ref = new RegExp(`@${id}(?![0-9])`)
    const usedIn: string[] = []
    if (ref.test(f)) usedIn.push('絞り込み')
    if (ref.test(so)) usedIn.push('並べ替え')
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
    commit({ ...latestState(), sortExpression: `@${id}`, sortDirection: direction })
  }

  // A municipality's detail page, carrying the current データの選択 along.
  const detailLink = (code: string) => {
    const q = writeSelectionParams(new URLSearchParams(), selection).toString()
    return `/m/${code}${q ? `?${q}` : ''}`
  }

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
          onApply={(expression) => { commit({ ...latestState(), filterExpression: expression }); setFilterOpen(false) }}
          onClear={() => { commit({ ...latestState(), filterExpression: '' }); setFilterOpen(false) }}
          onClose={() => setFilterOpen(false)}
        />
      )}
      {sortOpen && (
        <SortModal
          initialExpression={sortState?.expression ?? ''}
          initialDirection={sortState?.direction ?? 'desc'}
          columns={columnRefs}
          onApply={(expression, _typed, direction) => { commit({ ...latestState(), sortExpression: expression, sortDirection: direction }); setSortOpen(false) }}
          onClear={() => { commit({ ...latestState(), sortExpression: '', sortDirection: 'desc' }); setSortOpen(false) }}
          onClose={() => setSortOpen(false)}
        />
      )}
      {dataModal && (
        <DataModal
          focus={dataModal.focus} used={usedKeys}
          selection={selection}
          onApply={next => {
            setSelection(next)
            setDataModal(null)
          }}
          onClose={() => setDataModal(null)}
        />
      )}
      {searchOpen && (
        <SearchModal onApply={handleSearchApply} onClose={() => setSearchOpen(false)} />
      )}
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <AppHeader title={title} onMenuClick={() => setSidebarOpen(true)} />
      {mapColumn ? (
        // Map view: fills the screen below the header — no page scroll, so
        // drags and pinches always go to the map.
        <div className="fixed inset-x-0 top-11 bottom-0 flex flex-col">
          <PageHeader used={usedKeys} selection={selection} onDataClick={k => setDataModal({ focus: k })} compact />
          {toolbar}
          <div className="flex-1 min-h-0">
            <MapView
              column={mapColumn}
              columnOptions={numericColumns}
              onSelectColumn={id => setMapExpression(`@${id}`)}
              displayItems={mapItems}
              allItems={activeItems}
              designations={designations}
              coastal={coastal}
              fitToItems={filterExpr !== null}
              linkFor={detailLink}
            />
          </div>
        </div>
      ) : (
        // Table view: one scroll container for both axes, so the toolbar and
        // the table header stick to the top and the rank/name columns to the
        // left. The page header, toolbar and source note are pinned to the
        // left edge (100cqw = the container's visible width) so they don't
        // slide away when a wide table scrolls sideways.
        <main className="fixed inset-x-0 top-11 bottom-0 overflow-auto [container-type:inline-size]">
          <div className="sticky left-0 w-[100cqw]">
            <PageHeader used={usedKeys} selection={selection} onDataClick={k => setDataModal({ focus: k })} />
          </div>
          <div className="sticky top-0 left-0 z-40 w-[100cqw]">{toolbar}</div>
          <DataTable
            columns={columns}
            displayItems={displayItems}
            sortedColumnId={sortedColumn?.id ?? null}
            sortDirection={sortState?.direction ?? 'desc'}
            onEditColumn={id => setModal({ kind: 'edit', id })}
            onAddColumn={() => setModal({ kind: 'add' })}
            onSortColumn={handleSortColumn}
            linkFor={detailLink}
            envOf={envOf}
            highlight={searchParams.get('at') ?? undefined}
          />
        </main>
      )}
    </>
  )
}

export default MuniTable
