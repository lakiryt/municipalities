import { parseAndTypeCheck } from '@/lang/expr'
import { normalizeKana } from '@/data/municipalities'
import type { TypedExpr } from '@/lang/expr'

const KUBUN_EXPR = 'IF(&seirei, "政令指定都市", IF(&chukaku, "中核市", IF(&tokurei, "施行時特例市", "")))'

export const ALL_COL_DEFS = [
  { key: 'code',       group: '基本', label: '自治体コード',  expr: '$code' },
  { key: 'pref',       group: '基本', label: '都道府県',      expr: '$prefkanji' },
  { key: 'name',       group: '基本', label: '自治体名',      expr: '$kanji' },
  { key: 'kubun',      group: '基本', label: '区分',          expr: KUBUN_EXPR },
  { key: 'totalpop',   group: '人口', label: '総人口',        expr: '#totalpop' },
  { key: 'malepop',    group: '人口', label: '男性人口',      expr: '#malepop' },
  { key: 'femalepop',  group: '人口', label: '女性人口',      expr: '#femalepop' },
  { key: 'setai',      group: '人口', label: '世帯数',        expr: '#setai' },
  { key: 'prev_total', group: '人口', label: '前年人口',      expr: '#prev_total' },
  { key: 'area',       group: '面積', label: '面積(km²)',     expr: '#area' },
  { key: 'density',    group: '面積', label: '人口密度',      expr: 'ROUND(MULT(#totalpop, INV(#area)), 2)' },
  { key: 'incrate',    group: '増減', label: '増減率(%)',     expr: 'ROUND(MULT(100, #inc_rate), 2)' },
  { key: 'inc_net',    group: '増減', label: '増減数',        expr: '#inc_net' },
  { key: 'inc_nat',    group: '増減', label: '自然増減数',    expr: '#inc_nat' },
  { key: 'natrate',    group: '増減', label: '自然増減率(%)', expr: 'ROUND(MULT(100, #inc_nat_rate), 2)' },
  { key: 'inc_soc',    group: '増減', label: '社会増減数',    expr: '#inc_soc' },
  { key: 'socrate',    group: '増減', label: '社会増減率(%)', expr: 'ROUND(MULT(100, #inc_soc_rate), 2)' },
  { key: 'inc_mov',    group: '移動', label: '転入者数',      expr: '#inc_mov' },
  { key: 'dec_mov',    group: '移動', label: '転出者数',      expr: '#dec_mov' },
  { key: 'inc_born',   group: '移動', label: '出生数',        expr: '#inc_born' },
  { key: 'dec_deaths', group: '移動', label: '死亡数',        expr: '#dec_deaths' },
] as const

export type ColKey = typeof ALL_COL_DEFS[number]['key']
export type ColDef = typeof ALL_COL_DEFS[number]

export const COL_MAP = Object.fromEntries(ALL_COL_DEFS.map(c => [c.key, c])) as Record<ColKey, ColDef>

export const COL_TYPED = Object.fromEntries(
  ALL_COL_DEFS.map(c => [c.key, parseAndTypeCheck(c.expr)])
) as Record<ColKey, TypedExpr>

export const GROUPS = [...new Set(ALL_COL_DEFS.map(c => c.group))]

export const DEFAULT_ACTIVE_COLS: ColKey[] = ['pref', 'name', 'kubun', 'totalpop']

// ── Sort ──────────────────────────────────────────────────────────────────────

export type SortMode = 'num' | 'str' | 'code'

export type SortOption = {
  key: string
  label: string
  expr: string
  typed: TypedExpr
  mode: SortMode
}

export const ALL_SORT_OPTIONS: SortOption[] = [
  { key: 'code',     label: '自治体コード',        expr: '$code',     typed: parseAndTypeCheck('$code'),     mode: 'code' },
  { key: 'kana',     label: 'よみかた（市区町村）', expr: '$kana',     typed: parseAndTypeCheck('$kana'),     mode: 'str'  },
  { key: 'prefkana', label: 'よみかた（都道府県）', expr: '$prefkana', typed: parseAndTypeCheck('$prefkana'), mode: 'str'  },
  ...ALL_COL_DEFS
    .filter(c => parseAndTypeCheck(c.expr).type === 'n')
    .map(c => ({ key: c.key, label: c.label, expr: c.expr, typed: parseAndTypeCheck(c.expr), mode: 'num' as SortMode })),
]

export const DEFAULT_SORT_KEY = 'totalpop'

// ── Filter ────────────────────────────────────────────────────────────────────

export type MuniType = 'shi' | 'cho' | 'son' | 'ku'

export const MUNI_TYPES: { key: MuniType; label: string; char: string }[] = [
  { key: 'shi', label: '市', char: '市' },
  { key: 'cho', label: '町', char: '町' },
  { key: 'son', label: '村', char: '村' },
  { key: 'ku',  label: '区', char: '区' },
]

export type KubunKey = 'seirei' | 'chukaku' | 'tokurei'

export const KUBUN_OPTS: { key: KubunKey; label: string }[] = [
  { key: 'seirei',  label: '政令指定都市' },
  { key: 'chukaku', label: '中核市' },
  { key: 'tokurei', label: '施行時特例市' },
]

export type FilterState = {
  kana: string
  pref: string
  types: Record<MuniType, boolean>
  kubun: Record<KubunKey, boolean>
}

export const DEFAULT_FILTER_STATE: FilterState = {
  kana: '',
  pref: '',
  types: { shi: false, cho: false, son: false, ku: false },
  kubun: { seirei: false, chukaku: false, tokurei: false },
}

export function buildFilterExpr(state: FilterState): string | null {
  const { kana, pref, types, kubun } = state
  const parts: string[] = []
  const k = normalizeKana(kana.trim())
  if (k) parts.push(`EQ(SUBSTR($kana, ${k.length}), "${k}")`)
  if (pref) parts.push(`EQ($prefkanji, "${pref}")`)
  const activeTypes = MUNI_TYPES.filter(t => types[t.key])
  if (activeTypes.length > 0 && activeTypes.length < MUNI_TYPES.length) {
    const exprs = activeTypes.map(t => `EQ(SUBSTR($kanji, NEG(1)), "${t.char}")`)
    parts.push(exprs.length === 1 ? exprs[0] : `OR(${exprs.join(', ')})`)
  }
  const activeKubun = KUBUN_OPTS.filter(o => kubun[o.key])
  if (activeKubun.length > 0 && activeKubun.length < KUBUN_OPTS.length) {
    const exprs = activeKubun.map(o => `&${o.key}`)
    parts.push(exprs.length === 1 ? exprs[0] : `OR(${exprs.join(', ')})`)
  }
  if (parts.length === 0) return null
  return parts.length === 1 ? parts[0] : `AND(${parts.join(', ')})`
}
