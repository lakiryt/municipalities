import { useState } from 'react'
import dantai_codes from "@/assets/dantai_code_20240101.json"
import code_todofuken from "@/assets/code_todofuken_20240101.json"
import jumin from "@/assets/jumin2025.json"
import { parseAndTypeCheck, type TypedExpr } from "./testExpr"
import { evaluate, type Env } from "./evaluate"
import ColumnModal from "./ColumnModal"
import FilterModal from "./FilterModal"

const getPrefecture = (code: string) => {
  const prefecturePrefix = code.slice(0, 2)
  const prefecture = code_todofuken.find((item) => item.code.slice(0, 2) === prefecturePrefix)
  return {...prefecture, code}
}

const innerJoinSortedArraysBy = <K extends string | number>(key: (item: any) => K) =>
  <A extends object, B extends object>(as: A[], bs: B[]): (A & B)[] => {
    if (as.length === 0 || bs.length === 0) return []
    else {
      if (key(as[0]) === key(bs[0]))
        return [{...as[0], ...bs[0]}, ...innerJoinSortedArraysBy(key)(as.slice(1), bs.slice(1))]
      else if (key(as[0]) < key(bs[0]))
        return [...innerJoinSortedArraysBy(key)(as.slice(1), bs)]
      else
        return [...innerJoinSortedArraysBy(key)(as, bs.slice(1))]
    }
  }

type DantaiCodeEntry = (typeof dantai_codes)[number]
type JuminEntry = (typeof jumin)[number]

const joined = innerJoinSortedArraysBy((item: DantaiCodeEntry | JuminEntry) => item.code)(dantai_codes, jumin)

type BaseItem = {
  code: string
  kanji: string
  kana: string
  prefecture: {
    code: string
    kanji?: string
    kana?: string
  }
  population: {
    total: number
    male: number
    female: number
  }
}

const toBaseItem = (item: DantaiCodeEntry & JuminEntry): BaseItem => ({
  code: item.code,
  kanji: item.kanji,
  kana: item.kana,
  prefecture: getPrefecture(item.code),
  population: {
    total: Number(item.total) || 0,
    male: Number(item.male) || 0,
    female: Number(item.female) || 0
  }
})

const baseItemEnv = (item: BaseItem): Env => ({
  numvars: {
    total:  item.population.total,
    male:   item.population.male,
    female: item.population.female,
  },
  strvars: {
    code:      item.code,
    kanji:     item.kanji,
    kana:      item.kana,
    prefcode:  item.prefecture.code,
    prefkanji: item.prefecture.kanji ?? '',
    prefkana:  item.prefecture.kana ?? '',
  }
})

type ColumnState = {
  id: number
  label: string
  expression: string
  typed: TypedExpr
}

type ModalState =
  | { kind: 'edit'; id: number }
  | { kind: 'add' }

const initialExpressions = [
  { label: "コード",           expression: "$code" },
  { label: "都道府県名",       expression: "$prefkanji" },
  { label: "自治体名",         expression: "$kanji" },
  { label: "自治体名（カナ）", expression: "$kana" },
  { label: "総人口",           expression: "#total" },
]

const initialColumns: ColumnState[] = initialExpressions.map((col, i) => ({
  id: i,
  label: col.label,
  expression: col.expression,
  typed: parseAndTypeCheck(col.expression),
}))

const items = joined.map(toBaseItem)

function App() {
  const [columns, setColumns] = useState<ColumnState[]>(initialColumns)
  const [nextId, setNextId] = useState(initialColumns.length)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [filterExpr, setFilterExpr] = useState<TypedExpr | null>(null)
  const [filterExpression, setFilterExpression] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const editingColumn = modal?.kind === 'edit'
    ? columns.find(c => c.id === modal.id) ?? null
    : null

  const filteredItems = filterExpr !== null
    ? items.filter(item => evaluate(filterExpr, baseItemEnv(item)) === true)
    : items

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
    <main className="max-w-screen-xl mx-auto px-6 py-4">
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
      <div className="flex justify-end mb-2">
        <button
          className={`px-3 py-1 rounded text-sm border ${filterExpr !== null ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
          onClick={() => setFilterOpen(true)}
        >
          絞り込み{filterExpr !== null ? `（${filteredItems.length} / ${items.length}件）` : ''}
        </button>
      </div>
      <table className="border-collapse border border-gray-300">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.id}
                className="border border-gray-300 px-4 py-2 cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => setModal({ kind: 'edit', id: col.id })}
              >
                {col.label}
              </th>
            ))}
            <th
              className="border border-gray-300 px-4 py-2 cursor-pointer hover:bg-gray-50 text-gray-400 select-none"
              onClick={() => setModal({ kind: 'add' })}
            >
              +
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map(item => (
            <tr key={item.code}>
              {columns.map(col => (
                <td key={col.id} className="border border-gray-300 px-4 py-2">
                  {String(evaluate(col.typed, baseItemEnv(item)))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

export default App
