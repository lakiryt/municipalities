import code_todofuken from '@/assets/code_todofuken_20240101.json'
import dantai_codes from '@/assets/dantai_code_20240101.json'
import meta from '@/assets/meta.json'
import { parseAndTypeCheck } from '../lang/expr'
import { evaluate, type Env } from '../lang/evaluate'
import type { ColumnState } from '../types'

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
  rentInc0: number
  rentExc0: number
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

type RawPopSrc = {
  label: string; name: string; agency: string; as_of: string; source: string
} & ({ path: string } | { paths: { id: string; path: string }[] })

export type PopulationSource = {
  label: string; as_of: string; path: string;
  paths?: { id: string; path: string }[]
}

export const populationSources: PopulationSource[] = (meta.population as RawPopSrc[]).map(src =>
  'path' in src
    ? { label: src.label, as_of: src.as_of, path: src.path }
    : { label: src.label, as_of: src.as_of, path: src.paths[0].path, paths: src.paths }
)

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

const mergeMaps = (maps: PopulationMap[]): PopulationMap => {
  const merged = new Map<string, PopulationRecord>()
  for (const map of maps) {
    for (const [code, record] of map) {
      merged.set(code, { ...(merged.get(code) ?? {}), ...record })
    }
  }
  return merged
}

export const fetchPopulation = (src: PopulationSource): Promise<PopulationMap> => {
  if (src.paths) {
    return Promise.all(
      src.paths.map(p => fetch(`/${p.path}`).then(r => r.text()).then(parsePopulationCsv))
    ).then(mergeMaps)
  }
  return fetch(`/${src.path}`).then(r => r.text()).then(parsePopulationCsv)
}

// ── Municipality codes ────────────────────────────────────────────────────────

// 総務省統計局 標準地域コード: one row per prefecture, city, ward, or grouping
// (Hokkaido's 振興局, other prefectures' 郡). Rows the app has no area/population
// data for just render as "no data" — there's no need to tell them apart here.
export type CodeEntry = { code: string; kanji: string; kana: string }

const parseCodesCsv = (raw: string): CodeEntry[] =>
  raw.trim().split('\n').map(l => l.replace(/\r$/, '')).slice(1).map(line => {
    const [, , tiiki_code, , name1, name2, name3, yomigana] = line.split(',')
    return {
      code: tiiki_code,
      kanji: [name1, name2, name3].map(s => s.trim()).filter(Boolean).join(''),
      kana: (yomigana ?? '').trim(),
    }
  })

export const fetchMunicipalityCodes = (): Promise<CodeEntry[]> =>
  fetch('/codes/codes20230822.csv').then(r => r.text()).then(parseCodesCsv)

// The full CSV also includes designated-city wards and organizational rows
// (Hokkaido's 振興局, other prefectures' 郡); this is the narrower set of
// codes that are actual 地方公共団体, used to keep rankings to real
// municipalities. Names/readings aren't kept here — the CSV above is the
// source of truth for those now.
export const officialCodes: Set<string> = new Set(dantai_codes as string[])

// Some population sources (住民基本台帳) still key rows by the legacy 6-digit
// dantai code (5-digit code + a JIS X0401/0402 check digit) instead of the
// plain 5-digit code everything else in this app uses — this reproduces just
// enough of that checksum to look a row up under either key.
const checkDigit = (code5: string): number => {
  const weights = [6, 5, 4, 3, 2]
  const sum = code5.split('').reduce((acc, d, i) => acc + Number(d) * weights[i], 0)
  const cd = 11 - (sum % 11)
  return cd === 10 ? 0 : cd === 11 ? 1 : cd
}
const toCode6 = (code5: string): string => code5 + checkDigit(code5)

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
  { name: 'elderly_total',  expr: 'SUM(#total65_69, #total70_74, #total75_79, #total80_84, #total85_89, #total90_94, #total95_99, #total100_)',   desc: '65歳以上人口（計）' },
  { name: 'elderly_female', expr: 'SUM(#female65_69, #female70_74, #female75_79, #female80_84, #female85_89, #female90_94, #female95_99, #female100_)', desc: '65歳以上人口（女）' },
  { name: 'elderly_male',   expr: 'SUM(#male65_69, #male70_74, #male75_79, #male80_84, #male85_89, #male90_94, #male95_99, #male100_)',             desc: '65歳以上人口（男）' },
]

const derivedDefs = derivedExpressions.map(d => ({ name: d.name, typed: parseAndTypeCheck(d.expr) }))

// ── Designation data ──────────────────────────────────────────────────────────

export type DesignationSets = {
  seirei:  Set<string>
  chukaku: Set<string>
  tokurei: Set<string>
}

type DesignationsJson = {
  seirei:  { code: string }[]
  chukaku: string[]
  tokurei: string[]
}

export const fetchDesignations = (): Promise<DesignationSets> =>
  fetch('/designation/designations2022.json')
    .then(r => r.json() as Promise<DesignationsJson>)
    .then(data => ({
      seirei:  new Set(data.seirei.map(e => e.code)),
      chukaku: new Set(data.chukaku),
      tokurei: new Set(data.tokurei),
    }))

// ── Adjacency / coastal data ──────────────────────────────────────────────────

type AdjacencyJson = Record<string, string[]>

export const fetchCoastal = (): Promise<Set<string>> =>
  fetch('/maps/adjacency.json')
    .then(r => r.json() as Promise<AdjacencyJson>)
    .then(data => new Set(
      Object.entries(data).filter(([, neighbors]) => neighbors.includes('coast')).map(([code]) => code)
    ))

// ── Rent data ──────────────────────────────────────────────────────────────────

// 住宅の所有の関係別 延べ面積１m²当たり家賃: keyed by 5-digit code, each value is
// [家賃0円を含む, 家賃0円を含まない], each of those [総数, 公営, UR・公社, 民営, 給与住宅].
// Only 総数 (index 0) is surfaced. A category too small to report comes
// through as -1, same as a code with no entry at all — both become NaN.
type RentJson = Record<string, [number[], number[]]>

export const suppressedToNaN = (n: number | undefined): number => (n === undefined || n < 0 ? NaN : n)

export const fetchRent = (): Promise<Map<string, { inc0: number; exc0: number }>> =>
  fetch('/rent/rent20240925.json')
    .then(r => r.json() as Promise<RentJson>)
    .then(data => new Map(
      Object.entries(data).map(([code, [inc0, exc0]]): [string, { inc0: number; exc0: number }] => [
        code,
        { inc0: suppressedToNaN(inc0[0]), exc0: suppressedToNaN(exc0[0]) },
      ])
    ))

// ── Kana normalization ────────────────────────────────────────────────────────

// Converts any mix of hiragana / half-width katakana / full-width katakana to
// full-width katakana, so comparisons work regardless of input method.
// NFKC handles half-width katakana including combining dakuten (ﾀﾞ → ダ).
export const normalizeKana = (s: string): string =>
  s.normalize('NFKC').replace(/[ぁ-ゖ]/g, c =>
    String.fromCharCode(c.charCodeAt(0) + 0x60)
  )

// ── Municipality data ─────────────────────────────────────────────────────────

const getPrefecture = (code: string) => {
  const prefecturePrefix = code.slice(0, 2)
  const prefecture = code_todofuken.find(item => item.code.slice(0, 2) === prefecturePrefix)
  return { ...prefecture, code }
}

export const buildItems = (
  popMap: PopulationMap, areaMap: Map<string, number>, codes: CodeEntry[],
  rentMap: Map<string, { inc0: number; exc0: number }> = new Map()
): BaseItem[] =>
  codes.map(item => ({
    code: item.code,
    kanji: item.kanji,
    kana: item.kana,
    prefecture: getPrefecture(item.code),
    population: popMap.get(item.code) ?? popMap.get(toCode6(item.code)) ?? {},
    area: areaMap.get(item.code) ?? NaN,
    rentInc0: rentMap.get(item.code)?.inc0 ?? NaN,
    rentExc0: rentMap.get(item.code)?.exc0 ?? NaN,
  }))

export const baseItemEnv = (item: BaseItem, designations?: DesignationSets, coastal?: Set<string>): Env => {
  const numvars: Record<string, number> = {
    ...item.population,
    area: item.area,
    rent_inc0: item.rentInc0,
    rent_exc0: item.rentExc0,
  }
  const strvars: Record<string, string> = {
    code:      item.code,
    kanji:     item.kanji,
    kana:      normalizeKana(item.kana),
    prefcode:  item.prefecture.code,
    prefkanji: item.prefecture.kanji ?? '',
    prefkana:  item.prefecture.kana ?? '',
  }
  const boolvars: Record<string, boolean> = {
    seirei:  designations?.seirei.has(item.code)  ?? false,
    chukaku: designations?.chukaku.has(item.code) ?? false,
    tokurei: designations?.tokurei.has(item.code) ?? false,
    coastal: coastal?.has(item.code) ?? false,
  }
  for (const { name, typed } of derivedDefs) {
    numvars[name] = evaluate(typed, { numvars, strvars, boolvars }) as number
  }
  return { numvars, strvars, boolvars }
}

// Seed with all jumin + demog fields so varCompletions covers them statically
const _ageSuffixes = ['0_4','5_9','10_14','15_19','20_24','25_29','30_34','35_39','40_44',
  '45_49','50_54','55_59','60_64','65_69','70_74','75_79','80_84','85_89','90_94','95_99','100_']
const _demogSeed = Object.fromEntries([
  ..._ageSuffixes.map(s => [`total${s}`, 0]),
  ..._ageSuffixes.map(s => [`female${s}`, 0]),
  ..._ageSuffixes.map(s => [`male${s}`, 0]),
])
const _dummy: BaseItem = {
  code: '', kanji: '', kana: '',
  prefecture: { code: '' },
  population: {
    totalpop: 0, malepop: 0, femalepop: 0, setai: 0,
    inc_mov_dom: 0, inc_mov_intl: 0, inc_born: 0, inc_other: 0,
    dec_mov_dom: 0, dec_mov_intl: 0, dec_deaths: 0, dec_other: 0,
    ..._demogSeed,
  },
  area: 0,
  rentInc0: 0,
  rentExc0: 0,
}

export const prefectures = code_todofuken

const _dummyDesignations: DesignationSets = {
  seirei: new Set(), chukaku: new Set(), tokurei: new Set(),
}

export const varCompletions: string[] = [
  ...Object.keys(baseItemEnv(_dummy).numvars).map(k => `#${k}`),
  ...Object.keys(baseItemEnv(_dummy).strvars).map(k => `$${k}`),
  ...Object.keys(baseItemEnv(_dummy, _dummyDesignations).boolvars).map(k => `&${k}`),
]

export const initialColumns: ColumnState[] = [
  { label: '自治体コード',     expression: '$code' },
  { label: '都道府県名', expression: '$prefkanji' },
  { label: '自治体名',   expression: '$kanji' },
  { label: '総人口',     expression: '#totalpop' },
  { label: '面積',       expression: '#area' },
].map((col, i) => ({ id: i, ...col, typed: parseAndTypeCheck(col.expression) }))
