import dantai_codes from '@/assets/dantai_code_20240101.json'
import code_todofuken from '@/assets/code_todofuken_20240101.json'
import meta from '@/assets/meta.json'
import { parseAndTypeCheck } from '../lang/expr'
import { evaluate, type Env } from '../lang/evaluate'
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
  population: Record<string, number>
  area: number
}

export type PopulationRecord = Record<string, number>
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

const parsePopulationCsv = (raw: string): PopulationMap => {
  const lines = raw.trim().split('\n').map(l => l.replace(/\r$/, ''))
  const headers = lines[0].split(',')
  const codeIdx = headers.indexOf('code')
  return new Map(
    lines.slice(1).map((line): [string, PopulationRecord] => {
      const fields = line.split(',')
      const record: PopulationRecord = {}
      headers.forEach((h, i) => { if (i !== codeIdx) record[h] = Number(fields[i]) })
      return [fields[codeIdx], record]
    })
  )
}

export const fetchPopulation = (src: { path: string }): Promise<PopulationMap> =>
  fetch(`/${src.path}`)
    .then(r => r.text())
    .then(parsePopulationCsv)

// ── Derived expressions ───────────────────────────────────────────────────────

// Evaluated in order so later entries can reference earlier ones as numvars
export const derivedExpressions = [
  { name: 'popdensity',   expr: 'MULT(#totalpop, INV(#area))',                                    desc: '人口密度（人/km²）' },
  { name: 'inc_mov',      expr: 'SUM(#inc_mov_dom, #inc_mov_intl)',                               desc: '転入者数（計）' },
  { name: 'inc',          expr: 'SUM(#inc_mov_dom, #inc_mov_intl, #inc_born, #inc_other)',        desc: '昨年の住民票記載数' },
  { name: 'dec_mov',      expr: 'SUM(#dec_mov_dom, #dec_mov_intl)',                               desc: '転出者数（計）' },
  { name: 'dec',          expr: 'SUM(#dec_mov_dom, #dec_mov_intl, #dec_deaths, #dec_other)',      desc: '昨年の住民票消除数' },
  { name: 'inc_net',      expr: 'SUM(#inc, NEG(#dec))',                                           desc: '住民票増減数' },
  { name: 'prev_total',   expr: 'SUM(#totalpop, NEG(#inc_net))',                                  desc: '前年の人口' },
  { name: 'inc_rate',     expr: 'MULT(#inc_net, INV(#prev_total))',                               desc: '増減率' },
  { name: 'inc_nat',      expr: 'SUM(#inc_born, NEG(#dec_deaths))',                               desc: '自然増減数' },
  { name: 'inc_nat_rate', expr: 'MULT(#inc_nat, INV(#prev_total))',                               desc: '自然増減率' },
  { name: 'inc_soc',      expr: 'SUM(#inc_mov, #inc_other, NEG(SUM(#dec_mov, #dec_other)))',      desc: '社会増減数' },
  { name: 'inc_soc_rate', expr: 'MULT(#inc_soc, INV(#prev_total))',                               desc: '社会増減率' },
]

const derivedDefs = derivedExpressions.map(d => ({ name: d.name, typed: parseAndTypeCheck(d.expr) }))

// ── Municipality data ─────────────────────────────────────────────────────────

const getPrefecture = (code: string) => {
  const prefecturePrefix = code.slice(0, 2)
  const prefecture = code_todofuken.find(item => item.code.slice(0, 2) === prefecturePrefix)
  return { ...prefecture, code }
}

export const buildItems = (popMap: PopulationMap, areaMap: Map<string, number>): BaseItem[] =>
  (dantai_codes as DantaiCodeEntry[]).map(item => {
    const code5 = item.code.slice(0, -1)
    return {
      code: item.code,
      kanji: item.kanji,
      kana: item.kana,
      prefecture: getPrefecture(item.code),
      population: popMap.get(code5) ?? popMap.get(item.code) ?? {},
      area: areaMap.get(code5) ?? NaN,
    }
  })

export const baseItemEnv = (item: BaseItem): Env => {
  const numvars: Record<string, number> = {
    ...item.population,
    area: item.area,
  }
  const strvars: Record<string, string> = {
    code:      item.code,
    kanji:     item.kanji,
    kana:      item.kana,
    prefcode:  item.prefecture.code,
    prefkanji: item.prefecture.kanji ?? '',
    prefkana:  item.prefecture.kana ?? '',
  }
  for (const { name, typed } of derivedDefs) {
    numvars[name] = evaluate(typed, { numvars, strvars }) as number
  }
  return { numvars, strvars }
}

// Seed with all jumin fields so varCompletions covers them statically
const _dummy: BaseItem = {
  code: '', kanji: '', kana: '',
  prefecture: { code: '' },
  population: {
    totalpop: 0, malepop: 0, femalepop: 0, setai: 0,
    inc_mov_dom: 0, inc_mov_intl: 0, inc_born: 0, inc_other: 0,
    dec_mov_dom: 0, dec_mov_intl: 0, dec_deaths: 0, dec_other: 0,
  },
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
