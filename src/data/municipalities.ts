import dantai_codes from '@/assets/dantai_code_20240101.json'
import code_todofuken from '@/assets/code_todofuken_20240101.json'
import jumin from '@/assets/jumin2025.json'
import { parseAndTypeCheck } from '../lang/expr'
import type { Env } from '../lang/evaluate'
import type { ColumnState } from '../types'

type DantaiCodeEntry = (typeof dantai_codes)[number]
type JuminEntry = (typeof jumin)[number]

export type BaseItem = {
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

const getPrefecture = (code: string) => {
  const prefecturePrefix = code.slice(0, 2)
  const prefecture = code_todofuken.find(item => item.code.slice(0, 2) === prefecturePrefix)
  return { ...prefecture, code }
}

const innerJoinSortedArraysBy = <K extends string | number>(key: (item: any) => K) =>
  <A extends object, B extends object>(as: A[], bs: B[]): (A & B)[] => {
    if (as.length === 0 || bs.length === 0) return []
    if (key(as[0]) === key(bs[0]))
      return [{ ...as[0], ...bs[0] }, ...innerJoinSortedArraysBy(key)(as.slice(1), bs.slice(1))]
    if (key(as[0]) < key(bs[0]))
      return innerJoinSortedArraysBy(key)(as.slice(1), bs)
    return innerJoinSortedArraysBy(key)(as, bs.slice(1))
  }

const toBaseItem = (item: DantaiCodeEntry & JuminEntry): BaseItem => ({
  code: item.code,
  kanji: item.kanji,
  kana: item.kana,
  prefecture: getPrefecture(item.code),
  population: {
    total: Number(item.total) || 0,
    male: Number(item.male) || 0,
    female: Number(item.female) || 0,
  },
})

export const baseItemEnv = (item: BaseItem): Env => ({
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
  },
})

export const items: BaseItem[] = innerJoinSortedArraysBy(
  (item: DantaiCodeEntry | JuminEntry) => item.code
)(dantai_codes, jumin).map(toBaseItem)

export const initialColumns: ColumnState[] = [
  { label: 'コード',           expression: '$code' },
  { label: '都道府県名',       expression: '$prefkanji' },
  { label: '自治体名',         expression: '$kanji' },
  { label: '自治体名（カナ）', expression: '$kana' },
  { label: '総人口',           expression: '#total' },
].map((col, i) => ({ id: i, ...col, typed: parseAndTypeCheck(col.expression) }))
