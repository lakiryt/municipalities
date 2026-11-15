// Every variable an expression can use, declared once. The type checker
// rejects any other name (a typo is an error, not a column of NaN), the
// environment a row is evaluated in must provide each of these (Env's types
// say so), and the editor's completions are this list.

/** 住民基本台帳 age brackets: totalX, maleX, femaleX for each. */
export const AGE_BRACKETS = ['0_4', '5_9', '10_14', '15_19', '20_24', '25_29', '30_34', '35_39', '40_44', '45_49',
  '50_54', '55_59', '60_64', '65_69', '70_74', '75_79', '80_84', '85_89', '90_94', '95_99', '100_'] as const
type AgeBracket = typeof AGE_BRACKETS[number]

/** Columns of the population (住民基本台帳) data. */
export const POPULATION_VARS: readonly PopulationVar[] = [
  'totalpop', 'malepop', 'femalepop', 'setai',
  'inc_mov_dom', 'inc_mov_intl', 'inc_born', 'inc_other',
  'dec_mov_dom', 'dec_mov_intl', 'dec_deaths', 'dec_other',
  ...AGE_BRACKETS.flatMap(b => [`total${b}`, `male${b}`, `female${b}`] as const),
]
export type PopulationVar =
  | 'totalpop' | 'malepop' | 'femalepop' | 'setai'
  | 'inc_mov_dom' | 'inc_mov_intl' | 'inc_born' | 'inc_other'
  | 'dec_mov_dom' | 'dec_mov_intl' | 'dec_deaths' | 'dec_other'
  | `${'total' | 'male' | 'female'}${AgeBracket}`

/** Numbers from the other datasets. */
export const DATA_VARS = ['area', 'rent_inc0', 'rent_exc0', 'rent_private', 'minwage', 'pop_from', 'pop_to'] as const

// Computed from the others, in this order (a later one may use an earlier one).
export const DERIVED = [
  { name: 'popdensity',      expr: 'MULT(#totalpop, INV(#area))',                               desc: '人口密度（人/km²）' },
  { name: 'inc_mov',         expr: 'SUM(#inc_mov_dom, #inc_mov_intl)',                          desc: '転入者数（計）' },
  { name: 'inc',             expr: 'SUM(#inc_mov_dom, #inc_mov_intl, #inc_born, #inc_other)',   desc: '昨年の住民票記載数' },
  { name: 'dec_mov',         expr: 'SUM(#dec_mov_dom, #dec_mov_intl)',                          desc: '転出者数（計）' },
  { name: 'dec',             expr: 'SUM(#dec_mov_dom, #dec_mov_intl, #dec_deaths, #dec_other)', desc: '昨年の住民票消除数' },
  { name: 'inc_net',         expr: 'SUM(#inc, NEG(#dec))',                                      desc: '住民票増減数' },
  { name: 'prev_total',      expr: 'SUM(#totalpop, NEG(#inc_net))',                             desc: '前年の人口' },
  { name: 'inc_rate',        expr: 'MULT(#inc_net, INV(#prev_total))',                          desc: '増減率' },
  { name: 'inc_nat',         expr: 'SUM(#inc_born, NEG(#dec_deaths))',                          desc: '自然増減数' },
  { name: 'inc_nat_rate',    expr: 'MULT(#inc_nat, INV(#prev_total))',                          desc: '自然増減率' },
  { name: 'inc_soc',         expr: 'SUM(#inc_mov, #inc_other, NEG(SUM(#dec_mov, #dec_other)))', desc: '社会増減数' },
  { name: 'inc_soc_rate',    expr: 'MULT(#inc_soc, INV(#prev_total))',                          desc: '社会増減率' },
  { name: 'pop_change',      expr: 'SUM(#pop_to, NEG(#pop_from))',                              desc: '人口増減数（比較する2時点）' },
  { name: 'pop_change_rate', expr: 'MULT(#pop_change, INV(#pop_from))',                         desc: '人口増減率（比較する2時点）' },
  { name: 'elderly_total',   expr: 'SUM(#total65_69, #total70_74, #total75_79, #total80_84, #total85_89, #total90_94, #total95_99, #total100_)', desc: '65歳以上人口（計）' },
  { name: 'elderly_female',  expr: 'SUM(#female65_69, #female70_74, #female75_79, #female80_84, #female85_89, #female90_94, #female95_99, #female100_)', desc: '65歳以上人口（女）' },
  { name: 'elderly_male',    expr: 'SUM(#male65_69, #male70_74, #male75_79, #male80_84, #male85_89, #male90_94, #male95_99, #male100_)', desc: '65歳以上人口（男）' },
] as const

export type NumVarName = PopulationVar | typeof DATA_VARS[number] | typeof DERIVED[number]['name']
export const STR_VARS = ['code', 'kanji', 'kana', 'prefcode', 'prefkanji', 'prefkana', 'kind'] as const
export type StrVarName = typeof STR_VARS[number]
export const BOOL_VARS = ['seirei', 'chukaku', 'tokurei', 'coastal', 'official'] as const
export type BoolVarName = typeof BOOL_VARS[number]

export const NUM_VARS: readonly NumVarName[] = [...POPULATION_VARS, ...DATA_VARS, ...DERIVED.map(d => d.name)]

const numSet: ReadonlySet<string> = new Set(NUM_VARS)
const strSet: ReadonlySet<string> = new Set(STR_VARS)
const boolSet: ReadonlySet<string> = new Set(BOOL_VARS)
export const isNumVar = (name: string): name is NumVarName => numSet.has(name)
export const isStrVar = (name: string): name is StrVarName => strSet.has(name)
export const isBoolVar = (name: string): name is BoolVarName => boolSet.has(name)

/** For the editor: every variable with its sigil. */
export const VAR_COMPLETIONS: readonly string[] = [
  ...NUM_VARS.map(v => `#${v}`), ...STR_VARS.map(v => `$${v}`), ...BOOL_VARS.map(v => `&${v}`),
]

/**
 * A record with exactly `keys` as its keys. (The one cast: Object.fromEntries
 * can't carry key types — the key list, typed from the declarations above,
 * is what makes the record complete.)
 */
export function recordOf<K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map(k => [k, value(k)])) as Record<K, V>
}
