import { useState } from 'react'
import dantai_codes from "@/assets/dantai_code_20240101.json"
import code_todofuken from "@/assets/code_todofuken_20240101.json"
import jumin from "@/assets/jumin2025.json"
import { parseAndTypeCheck, type TypedExpr } from "./testExpr"
import { evaluate, type Env } from "./evaluate"
import TestEditor from "./TestEditor"

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

type Column = {
  label: string
  expression: string
}

const staticColumns: Column[] = [
  { label: "コード",       expression: "$code" },
  { label: "都道府県名",   expression: "$prefkanji" },
  { label: "自治体名",     expression: "$kanji" },
  { label: "自治体名（カナ）", expression: "$kana" },
  { label: "総人口",       expression: "#total" },
]

const parsedStaticColumns = staticColumns.map(col => ({
  label: col.label,
  typed: parseAndTypeCheck(col.expression),
}))

const items = joined.map(toBaseItem)

function App() {
  const [editorExpr, setEditorExpr] = useState<TypedExpr | null>(null)

  const allColumns = [
    ...parsedStaticColumns,
    ...(editorExpr !== null ? [{ label: "式エディタ", typed: editorExpr }] : [])
  ]

  return (
    <main>
      <TestEditor onValidExpr={setEditorExpr} />
      <table className="border-collapse border border-gray-300">
        <thead>
          <tr>
            {allColumns.map(col => (
              <th key={col.label} className="border border-gray-300 px-4 py-2">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.code}>
              {allColumns.map(col => (
                <td key={col.label} className="border border-gray-300 px-4 py-2">
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
