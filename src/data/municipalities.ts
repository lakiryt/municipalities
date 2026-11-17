import { parseAndTypeCheck } from '../lang/expr'
import { evalNum, type Env } from '../lang/evaluate'
import { DERIVED_DEFS } from '../lang/derived'
import { fromData, nodata, type Num, type Str, type Bool } from '../lang/value'
import {
  DERIVED, DATA_VARS, POPULATION_VARS, VAR_COMPLETIONS, recordOf, type NumVarName, type StrVarName, type BoolVarName,
} from '../lang/variables'
import type { ColumnState } from '../types'
import {
  prefectures, officialCodes, type PopulationMap, type CodeEntry, type RentMap, type MinWageMap, type DesignationSets, type ChangeMap,
} from './datasets'

// One row of the table/map: a 標準地域コード entry joined with the selected
// editions of every dataset (see buildItems). Loading those datasets lives in
// ./datasets; this module turns them into items and expression environments.
export type BaseItem = {
  code: string
  kanji: string
  kana: string
  // 市 / 町 / 村 / 特別区 / 政令市の区 / 都道府県, or '' for grouping rows (郡・振興局)
  kind: string
  // An actual 地方公共団体 (総務省 全国地方公共団体コード): 市町村 and 特別区,
  // not a designated city's wards.
  official: boolean
  // A designated-city ward's city (its code); '' otherwise.
  parent: string
  prefecture: {
    code: string
    kanji?: string
    kana?: string
  }
  population: Record<string, number>
  area: number
  rentInc0: number
  rentExc0: number
  rentPrivate: number
  minWage: number
  // 人口増減: total population in the two compared editions (データの選択)
  popFrom: number
  popTo: number
}

// ── Derived expressions ───────────────────────────────────────────────────────

// Declared in lang/variables.ts (with every other variable); parsed once here.
export const derivedExpressions = DERIVED



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
  const prefecture = prefectures.find(item => item.code.slice(0, 2) === prefecturePrefix)
  return { ...prefecture, code }
}

/** What kind of place a 標準地域コード row is. */
export function kindOf(entry: { code: string; kanji: string; parent: string }): string {
  if (entry.code.endsWith('000')) return '都道府県'
  if (officialCodes.has(entry.code)) {
    const last = entry.kanji.slice(-1)
    return last === '区' ? '特別区' : last
  }
  return entry.parent ? '政令市の区' : ''
}

export const buildItems = (
  popMap: PopulationMap, areaMap: Map<string, number>, codes: CodeEntry[],
  rentMap: RentMap = new Map(),
  minWageMap: MinWageMap = new Map(),
  changeMap: ChangeMap = new Map()
): BaseItem[] => {
  // ward → its city's code, by the city's name within the prefecture
  const cityCode = new Map(codes.filter(c => officialCodes.has(c.code)).map(c => [`${c.code.slice(0, 2)}:${c.kanji}`, c.code]))
  return codes.map(item => ({
    code: item.code,
    kanji: item.kanji,
    kana: item.kana,
    kind: kindOf(item),
    official: officialCodes.has(item.code),
    parent: item.parent ? cityCode.get(`${item.code.slice(0, 2)}:${item.parent}`) ?? '' : '',
    prefecture: getPrefecture(item.code),
    population: popMap.get(item.code) ?? {},
    area: areaMap.get(item.code) ?? NaN,
    rentInc0: rentMap.get(item.code)?.inc0 ?? NaN,
    rentExc0: rentMap.get(item.code)?.exc0 ?? NaN,
    rentPrivate: rentMap.get(item.code)?.private ?? NaN,
    minWage: minWageMap.get(item.code.slice(0, 2))?.min ?? NaN,
    popFrom: changeMap.get(item.code)?.from ?? NaN,
    popTo: changeMap.get(item.code)?.to ?? NaN,
  }))
}

// Membership in a set not loaded (yet) is unknown, not false.
const member = (set: Set<string> | undefined, code: string, source: string): Bool =>
  set ? set.has(code) : nodata(source)

export const baseItemEnv = (item: BaseItem, designations?: DesignationSets, coastal?: Set<string>): Env => {
  // Every declared variable gets a value — the types (Record<NumVarName, …>)
  // don't let one be left out. Where the data has none, the value says so.
  const data: Record<typeof DATA_VARS[number], number> = {
    area: item.area,
    rent_inc0: item.rentInc0,
    rent_exc0: item.rentExc0,
    rent_private: item.rentPrivate,
    minwage: item.minWage,
    pop_from: item.popFrom,
    pop_to: item.popTo,
  }
  const numvars: Record<NumVarName, Num> = {
    ...recordOf(POPULATION_VARS, k => fromData(item.population[k], `#${k}`)),
    ...recordOf(DATA_VARS, k => fromData(data[k], `#${k}`)),
    // Computed below. Each derived variable uses only earlier ones (checked in
    // lang/derived.ts), so these placeholders are never read.
    ...recordOf(DERIVED.map(d => d.name), k => nodata(`#${k}`)),
  }
  const strvars: Record<StrVarName, Str> = {
    code:      item.code,
    kanji:     item.kanji,
    kana:      normalizeKana(item.kana),
    prefcode:  item.prefecture.code,
    prefkanji: item.prefecture.kanji ?? nodata('$prefkanji'),
    prefkana:  item.prefecture.kana ?? nodata('$prefkana'),
    kind:      item.kind,
  }
  const boolvars: Record<BoolVarName, Bool> = {
    seirei:  member(designations?.seirei, item.code, '&seirei'),
    chukaku: member(designations?.chukaku, item.code, '&chukaku'),
    tokurei: member(designations?.tokurei, item.code, '&tokurei'),
    coastal: member(coastal, item.code, '&coastal'),
    official: item.official,
  }
  for (const { name, typed } of DERIVED_DEFS) {
    numvars[name] = evalNum(typed, { numvars, strvars, boolvars })
  }
  return { numvars, strvars, boolvars }
}

export const varCompletions: readonly string[] = VAR_COMPLETIONS

// 自由探索's starting columns. Name first so it can stay pinned on narrow
// screens; ids are fixed (not positions) so older `@id` URLs still resolve.
export const initialColumns: ColumnState[] = [
  { id: 2, label: '自治体名',   expression: '$kanji' },
  { id: 1, label: '都道府県名', expression: '$prefkanji' },
  { id: 3, label: '総人口',     expression: '#totalpop' },
  { id: 4, label: '面積',       expression: '#area' },
  { id: 0, label: '自治体コード', expression: '$code' },
].map(col => ({ ...col, typed: parseAndTypeCheck(col.expression) }))
