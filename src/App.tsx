import dantai_codes from "@/assets/dantai_code_20240101.json"
import code_todofuken from "@/assets/code_todofuken_20240101.json"
import jumin from "@/assets/jumin2025.json"
import type { BaseItemValue, Expression, Formula } from "./expression"
import { calculate } from "./expression"
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

const canonicalItems = {
  code: {label: "団体コード", valueGetter: (item: BaseItem) => item.code},
  kanji: {label: "団体名", valueGetter: (item: BaseItem) => item.kanji},
  kana: {label: "カナ", valueGetter: (item: BaseItem) => item.kana},
  prefecture: {
    code: {label: "都道府県コード", valueGetter: (item: BaseItem) => item.prefecture.code},
    kanji: {label: "都道府県名", valueGetter: (item: BaseItem) => item.prefecture.kanji},
    kana: {label: "都道府県カナ", valueGetter: (item: BaseItem) => item.prefecture.kana}
  },
  population: {
    total: {label: "人口", valueGetter: (item: BaseItem) => item.population.total} as BaseItemValue<number, BaseItem>,
    male: {label: "男性人口", valueGetter: (item: BaseItem) => item.population.male} as BaseItemValue<number, BaseItem>,
    female: {label: "女性人口", valueGetter: (item: BaseItem) => item.population.female} as BaseItemValue<number, BaseItem>
  }
}

type Column = {
  label: string
  expression: Expression<BaseItem>
}


const columns : Column[] = [
  {label: "コード", expression: canonicalItems.code},
  {label: "女性余剰人口", expression: {addends: [canonicalItems.population.male, {negatedvalue: canonicalItems.population.female}]}}
]

const isFormula = (value: BaseItemValue<string, BaseItem> | Formula<BaseItem>): value is Formula<BaseItem> =>
  "addends" in value || "negatedvalue" in value

function App() {
  return (
    <main>
      <TestEditor />
      <table className="border-collapse border border-gray-300">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.label} className="border border-gray-300 px-4 py-2">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {joined.map(toBaseItem).map((item : BaseItem) => (
            <tr key={item.code}>
              {columns.map((col) => (
                <td key={col.label} className="border border-gray-300 px-4 py-2">
                  {isFormula(col.expression) ? calculate(col.expression)(item) : col.expression.valueGetter(item)}
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
