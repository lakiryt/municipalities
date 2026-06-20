import dantai_codes from '@/assets/dantai_code_20240101.json'
import code_todofuken from '@/assets/code_todofuken_20240101.json'
import meta from '@/assets/meta.json'
import { parseAndTypeCheck } from '../lang/expr'
import type { Env } from '../lang/evaluate'
import type { ColumnState } from '../types'

type DantaiCodeEntry = (typeof dantai_codes)[number]

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
  area: number
}

export type PopulationRecord = { total: number; male: number; female: number }
export type PopulationMap = Map<string, PopulationRecord>

// ── Area data ─────────────────────────────────────────────────────────────────

export const areaSources = meta.area

export const parseAreaCsv = (raw: string): Map<string, number> =>
  new Map(raw.trim().split('\n').map((line): [string, number] => {
    const [code, area] = line.split(',')
    return [code, Number(area)]
  }))

export const fetchArea = (src: { path: string }): Promise<Map<string, number>> =>
  fetch(`/${src.path}`)
    .then(r => r.text())
    .then(parseAreaCsv)

// ── Population data ───────────────────────────────────────────────────────────

export const populationSources = meta.population

type JuminEntry = { code: string; total: string; male: string; female: string }

const parseJuminJson = (raw: string): PopulationMap => {
  const entries: JuminEntry[] = JSON.parse(raw)
  return new Map(entries.map(e => [
    e.code.slice(0, -1),
    { total: Number(e.total), male: Number(e.male), female: Number(e.female) },
  ]))
}

const parseKokuseiCsv = (raw: string): PopulationMap =>
  new Map(raw.trim().split('\n').map((line): [string, PopulationRecord] => {
    const [code, total, male, female] = line.split(',')
    return [code, { total: Number(total), male: Number(male), female: Number(female) }]
  }))

export const fetchPopulation = (src: { path: string }): Promise<PopulationMap> =>
  fetch(`/${src.path}`)
    .then(r => r.text())
    .then(raw => src.path.endsWith('.json') ? parseJuminJson(raw) : parseKokuseiCsv(raw))

// ── Municipality data ─────────────────────────────────────────────────────────

const getPrefecture = (code: string) => {
  const prefecturePrefix = code.slice(0, 2)
  const prefecture = code_todofuken.find(item => item.code.slice(0, 2) === prefecturePrefix)
  return { ...prefecture, code }
}

export const buildItems = (popMap: PopulationMap, areaMap: Map<string, number>): BaseItem[] =>
  (dantai_codes as DantaiCodeEntry[]).map(item => {
    const code5 = item.code.slice(0, -1)
    const pop = popMap.get(code5) ?? { total: 0, male: 0, female: 0 }
    return {
      code: item.code,
      kanji: item.kanji,
      kana: item.kana,
      prefecture: getPrefecture(item.code),
      population: pop,
      area: areaMap.get(code5) ?? 0,
    }
  })

export const baseItemEnv = (item: BaseItem): Env => ({
  numvars: {
    totalpop:  item.population.total,
    malepop:   item.population.male,
    femalepop: item.population.female,
    area:      item.area,
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

const _dummy: BaseItem = {
  code: '', kanji: '', kana: '',
  prefecture: { code: '' },
  population: { total: 0, male: 0, female: 0 },
  area: 0,
}

export const prefectures = code_todofuken

export const varCompletions: string[] = [
  ...Object.keys(baseItemEnv(_dummy).numvars).map(k => `#${k}`),
  ...Object.keys(baseItemEnv(_dummy).strvars).map(k => `$${k}`),
]

export const initialColumns: ColumnState[] = [
  { label: 'コード',     expression: '$code' },
  { label: '都道府県名', expression: '$prefkanji' },
  { label: '自治体名',   expression: '$kanji' },
  { label: '総人口',     expression: '#totalpop' },
  { label: '面積',       expression: '#area' },
].map((col, i) => ({ id: i, ...col, typed: parseAndTypeCheck(col.expression) }))
