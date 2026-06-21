import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  buildItems, baseItemEnv, fetchArea, fetchPopulation, fetchDesignations,
  normalizeKana, areaSources, populationSources, prefectures,
  type PopulationRecord, type DesignationSets,
} from '../../data/municipalities'
import { parseAndTypeCheck, type TypedExpr } from '../../lang/expr'
import { evaluate } from '../../lang/evaluate'

// ── Column catalogue ──────────────────────────────────────────────────────────

const KUBUN_EXPR = 'IF(&seirei, "政令指定都市", IF(&chukaku, "中核市", IF(&tokurei, "施行時特例市", "")))'

const ALL_COL_DEFS = [
  { key: 'code',       group: '基本', label: 'コード',         expr: '$code' },
  { key: 'pref',       group: '基本', label: '都道府県',       expr: '$prefkanji' },
  { key: 'name',       group: '基本', label: '自治体名',       expr: '$kanji' },
  { key: 'kubun',      group: '基本', label: '区分',           expr: KUBUN_EXPR },
  { key: 'totalpop',   group: '人口', label: '総人口',         expr: '#totalpop' },
  { key: 'malepop',    group: '人口', label: '男性人口',       expr: '#malepop' },
  { key: 'femalepop',  group: '人口', label: '女性人口',       expr: '#femalepop' },
  { key: 'setai',      group: '人口', label: '世帯数',         expr: '#setai' },
  { key: 'prev_total', group: '人口', label: '前年人口',       expr: '#prev_total' },
  { key: 'area',       group: '面積', label: '面積(km²)',      expr: '#area' },
  { key: 'density',    group: '面積', label: '人口密度',       expr: 'ROUND(MULT(#totalpop, INV(#area)), 2)' },
  { key: 'incrate',    group: '増減', label: '増減率(%)',      expr: 'ROUND(MULT(100, #inc_rate), 2)' },
  { key: 'inc_net',    group: '増減', label: '増減数',         expr: '#inc_net' },
  { key: 'inc_nat',    group: '増減', label: '自然増減数',     expr: '#inc_nat' },
  { key: 'natrate',    group: '増減', label: '自然増減率(%)',  expr: 'ROUND(MULT(100, #inc_nat_rate), 2)' },
  { key: 'inc_soc',    group: '増減', label: '社会増減数',     expr: '#inc_soc' },
  { key: 'socrate',    group: '増減', label: '社会増減率(%)',  expr: 'ROUND(MULT(100, #inc_soc_rate), 2)' },
  { key: 'inc_mov',    group: '移動', label: '転入者数',       expr: '#inc_mov' },
  { key: 'dec_mov',    group: '移動', label: '転出者数',       expr: '#dec_mov' },
  { key: 'inc_born',   group: '移動', label: '出生数',         expr: '#inc_born' },
  { key: 'dec_deaths', group: '移動', label: '死亡数',         expr: '#dec_deaths' },
] as const

type ColKey = typeof ALL_COL_DEFS[number]['key']
type ColDef = typeof ALL_COL_DEFS[number]

const COL_MAP = Object.fromEntries(ALL_COL_DEFS.map(c => [c.key, c])) as Record<ColKey, ColDef>

const COL_TYPED = Object.fromEntries(
  ALL_COL_DEFS.map(c => [c.key, parseAndTypeCheck(c.expr)])
) as Record<ColKey, TypedExpr>

const GROUPS = [...new Set(ALL_COL_DEFS.map(c => c.group))]

const DEFAULT_ACTIVE: ColKey[] = ['pref', 'name', 'kubun', 'totalpop']

// ── Filter helpers ────────────────────────────────────────────────────────────

type MuniType = 'shi' | 'cho' | 'son' | 'ku'
const MUNI_TYPES: { key: MuniType; label: string; char: string }[] = [
  { key: 'shi', label: '市', char: '市' },
  { key: 'cho', label: '町', char: '町' },
  { key: 'son', label: '村', char: '村' },
  { key: 'ku',  label: '区', char: '区' },
]

type KubunKey = 'seirei' | 'chukaku' | 'tokurei'
const KUBUN_OPTS: { key: KubunKey; label: string }[] = [
  { key: 'seirei',  label: '政令指定都市' },
  { key: 'chukaku', label: '中核市' },
  { key: 'tokurei', label: '施行時特例市' },
]

function buildFilterExpr(
  kana: string,
  pref: string,
  types: Record<MuniType, boolean>,
  kubun: Record<KubunKey, boolean>,
): string | null {
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

// ── Component ─────────────────────────────────────────────────────────────────

function SearchPage() {
  const [popMap,       setPopMap]       = useState(new Map<string, PopulationRecord>())
  const [areaMap,      setAreaMap]      = useState(new Map<string, number>())
  const [designations, setDesignations] = useState<DesignationSets | undefined>(undefined)

  useEffect(() => { fetchPopulation(populationSources[0]).then(setPopMap) }, [])
  useEffect(() => { fetchArea(areaSources[0]).then(setAreaMap) }, [])
  useEffect(() => { fetchDesignations().then(setDesignations) }, [])

  const [kana,          setKana]          = useState('')
  const [pref,          setPref]          = useState('')
  const [types,         setTypes]         = useState<Record<MuniType,  boolean>>({ shi: false, cho: false, son: false, ku: false })
  const [kubun,         setKubun]         = useState<Record<KubunKey,  boolean>>({ seirei: false, chukaku: false, tokurei: false })
  const [activeColKeys, setActiveColKeys] = useState<ColKey[]>(DEFAULT_ACTIVE)
  const [sortKey,       setSortKey]       = useState<ColKey>('totalpop')
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc')
  const [pickerOpen,    setPickerOpen]    = useState(false)

  const allItems = useMemo(() => buildItems(popMap, areaMap), [popMap, areaMap])

  const activeCols = useMemo(
    () => activeColKeys.map(k => COL_MAP[k]),
    [activeColKeys]
  )

  const numericActiveCols = useMemo(
    () => activeCols.filter(c => COL_TYPED[c.key].type === 'n'),
    [activeCols]
  )

  const effectiveSortKey = useMemo<ColKey | null>(() => {
    if (numericActiveCols.some(c => c.key === sortKey)) return sortKey
    return numericActiveCols[0]?.key ?? null
  }, [numericActiveCols, sortKey])

  const filterTyped = useMemo(() => {
    const expr = buildFilterExpr(kana, pref, types, kubun)
    if (!expr) return null
    try { return parseAndTypeCheck(expr) } catch { return null }
  }, [kana, pref, types, kubun])

  const displayItems = useMemo(() => {
    let items = allItems
    if (filterTyped) {
      items = items.filter(item => evaluate(filterTyped, baseItemEnv(item, designations)) === true)
    }
    if (effectiveSortKey) {
      const sortTyped = COL_TYPED[effectiveSortKey]
      items = [...items].sort((a, b) => {
        const va = evaluate(sortTyped, baseItemEnv(a, designations)) as number
        const vb = evaluate(sortTyped, baseItemEnv(b, designations)) as number
        if (isNaN(va) && isNaN(vb)) return 0
        if (isNaN(va)) return 1
        if (isNaN(vb)) return -1
        return sortDir === 'asc' ? va - vb : vb - va
      })
    }
    return items
  }, [allItems, filterTyped, effectiveSortKey, sortDir, designations])

  const toggleCol = (key: ColKey) =>
    setActiveColKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )

  const headLabel = 'text-xs font-semibold uppercase tracking-widest text-gray-400'
  const checkRow  = 'flex items-center gap-2 text-sm cursor-pointer select-none'

  return (
    <>
      <title>詳細検索</title>

      {/* Top bar */}
      <div className="fixed top-0 inset-x-0 z-20 h-11 flex items-center gap-3 bg-gray-50 border-b border-gray-200 px-4">
        <Link to="/"><img src="/favicon.svg" alt="home" className="h-6 w-6" /></Link>
        <span className="font-semibold text-sm">詳細検索</span>
        <span className="ml-auto text-sm text-gray-500">{displayItems.length.toLocaleString()}件</span>
      </div>

      {/* Search panel */}
      <div className="fixed top-11 left-0 bottom-0 w-64 overflow-y-auto border-r border-gray-200 bg-white">
        <div className="p-4 space-y-6">

          {/* Kana search */}
          <div>
            <label className={`block ${headLabel} mb-2`}>名前（よみかた）</label>
            <input
              type="text"
              value={kana}
              onChange={e => setKana(e.target.value)}
              placeholder="かな（前方一致）"
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
            />
          </div>

          {/* Prefecture */}
          <div>
            <label className={`block ${headLabel} mb-2`}>都道府県</label>
            <select
              value={pref}
              onChange={e => setPref(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
            >
              <option value="">全国</option>
              {prefectures.map(p => (
                <option key={p.code} value={p.kanji}>{p.kanji}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <p className={`${headLabel} mb-2`}>種別</p>
            <div className="grid grid-cols-2 gap-y-1.5">
              {MUNI_TYPES.map(t => (
                <label key={t.key} className={checkRow}>
                  <input type="checkbox" checked={types[t.key]}
                    onChange={() => setTypes(s => ({ ...s, [t.key]: !s[t.key] }))} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {/* Designation */}
          <div>
            <p className={`${headLabel} mb-2`}>区分</p>
            <div className="space-y-1.5">
              {KUBUN_OPTS.map(o => (
                <label key={o.key} className={checkRow}>
                  <input type="checkbox" checked={kubun[o.key]}
                    onChange={() => setKubun(s => ({ ...s, [o.key]: !s[o.key] }))} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          {/* Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={headLabel}>表示する列</p>
              <button
                onClick={() => setPickerOpen(o => !o)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {pickerOpen ? '完了' : '+ 追加'}
              </button>
            </div>

            {/* Active column chips */}
            <div className="space-y-1 mb-2">
              {activeCols.map(col => (
                <div key={col.key} className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-gray-700">{col.label}</span>
                  <button
                    onClick={() => setActiveColKeys(prev => prev.filter(k => k !== col.key))}
                    className="text-gray-300 hover:text-red-400 text-base leading-none px-1"
                    title="削除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Column picker */}
            {pickerOpen && (
              <div className="border border-gray-200 rounded overflow-hidden text-sm">
                {GROUPS.map(group => {
                  const cols = ALL_COL_DEFS.filter(c => c.group === group)
                  return (
                    <div key={group}>
                      <div className="px-2.5 py-1 text-xs font-semibold text-gray-400 bg-gray-50 border-b border-gray-200">
                        {group}
                      </div>
                      {cols.map(col => (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={activeColKeys.includes(col.key)}
                            onChange={() => toggleCol(col.key)}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sort — only visible numeric columns */}
          <div>
            <p className={`${headLabel} mb-2`}>並べ替え</p>
            {numericActiveCols.length === 0 ? (
              <p className="text-xs text-gray-400">数値の列を追加してください</p>
            ) : (
              <>
                <select
                  value={effectiveSortKey ?? ''}
                  onChange={e => setSortKey(e.target.value as ColKey)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white mb-2"
                >
                  {numericActiveCols.map(col => (
                    <option key={col.key} value={col.key}>{col.label}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  {(['desc', 'asc'] as const).map(dir => (
                    <button
                      key={dir}
                      onClick={() => setSortDir(dir)}
                      className={`flex-1 py-1 text-sm rounded border ${sortDir === dir ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
                    >
                      {dir === 'desc' ? '降順' : '昇順'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Results table */}
      <div className="fixed top-11 left-64 right-0 bottom-0 overflow-auto">
        <div className="pb-6 flex justify-center min-w-max">
          <table className="border-collapse border border-gray-300">
            <thead className="sticky top-0 z-10 shadow-md">
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-4 py-2 text-gray-400 select-none">#</th>
                {activeCols.map(col => (
                  <th
                    key={col.key}
                    className="border border-gray-300 bg-gray-50 px-4 py-2 text-left select-none whitespace-nowrap"
                  >
                    {col.label}
                    {col.key === effectiveSortKey && (
                      <span className="ml-1 text-gray-400 text-xs">{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, i) => (
                <tr key={item.code}>
                  <td className="border border-gray-300 px-4 py-2 text-right text-gray-400 tabular-nums">{i + 1}</td>
                  {activeCols.map(col => {
                    const v = evaluate(COL_TYPED[col.key], baseItemEnv(item, designations))
                    return (
                      <td key={col.key} className="border border-gray-300 px-4 py-2 whitespace-nowrap">
                        {typeof v === 'number' && isNaN(v) ? '—' : String(v)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default SearchPage
