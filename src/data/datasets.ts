// Access to the generated data (see DATA_PIPELINE.md). meta.json is written
// by `npm run data`: one entry per dataset, each with its editions newest
// first. Every file the app fetches is found through it — no data path is
// hard-coded here. All generated CSVs share one format: UTF-8, header row,
// first column `code` (5-digit), missing/suppressed values as empty cells.
import meta from '@/assets/meta.json'
import prefectureList from '@/assets/prefectures.json'
import dantaiCodes from '@/assets/dantai_codes.json'

// ── Datasets and editions ─────────────────────────────────────────────────────

export type Edition = {
  id: string
  as_of: string
  label?: string
  path: string
  adjacency?: string
  enabled?: boolean
}
export type DatasetMeta = {
  label: string; name?: string; agency?: string; page?: string
  editions: Edition[]
  // Files derived from all editions together, e.g. jumin's { series }.
  extras?: Record<string, string>
}

// The repo may hold editions that are switched off in the management UI
// (`enabled: false`); the app never sees those.
const allDatasets = (meta as unknown as { datasets: Record<string, DatasetMeta> }).datasets
export const dataset = (id: string): DatasetMeta => {
  const ds = allDatasets[id]
  return ds ? { ...ds, editions: ds.editions.filter(e => e.enabled !== false) } : { label: id, editions: [] }
}
const latest = (id: string): Edition | undefined => dataset(id).editions[0]

// ── CSV ───────────────────────────────────────────────────────────────────────

export const parseCsv = (raw: string): Record<string, string>[] => {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (quoted) {
      if (c === '"' && raw[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && raw[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

/** Empty cell → NaN, so "no data" is one value everywhere downstream. */
export const toNum = (s: string | undefined): number => (s === undefined || s === '' ? NaN : Number(s))

const fetchCsv = (path: string) => fetch(`/${path}`).then(r => r.text()).then(parseCsv)

// ── Selectable datasets ("データの選択") ──────────────────────────────────────

// `label` is the dataset (住民基本台帳, 国勢調査, …); `name` tells its editions
// apart — usually the date, but e.g. 国勢調査 has a 速報 and a 確定 edition
// for the same date, and surveys read better as "令和5年" / "2026年度".
// `key` identifies the edition in URLs (?pop=jumin:2025, ?area=2026-04-01).
export type Source = { dataset: string; key: string; label: string; name: string; as_of: string; path: string }

const NAMED_EDITIONS = new Set(['kokusei', 'rent', 'minwage'])
// Population mixes two datasets, so its keys carry the dataset id.
const PREFIXED_KEYS = new Set(['jumin', 'kokusei'])

const sourcesOf = (id: string): Source[] =>
  dataset(id).editions.map(e => ({
    dataset: id,
    key: PREFIXED_KEYS.has(id) ? `${id}:${e.id}` : e.id,
    label: dataset(id).label,
    name: NAMED_EDITIONS.has(id) ? (e.label ?? e.as_of) : e.as_of,
    as_of: e.as_of,
    path: e.path,
  }))

// The default minimum wage isn't an edition but "whatever is in effect today"
// (see pickEffectiveMinWages); a specific 年度 can be picked instead.
export const MINWAGE_EFFECTIVE = 'effective'

export const populationSources: Source[] = [...sourcesOf('jumin'), ...sourcesOf('kokusei')]
export const areaSources: Source[] = sourcesOf('area')
export const rentSources: Source[] = sourcesOf('rent')
export const minWageSources: Source[] = [
  { dataset: 'minwage', key: MINWAGE_EFFECTIVE, label: dataset('minwage').label, name: '現在（都道府県ごとに発効済みの額）', as_of: '', path: MINWAGE_EFFECTIVE },
  ...sourcesOf('minwage'),
]

/** Which edition of each selectable dataset the table/map uses, by path. */
export type DataSelection = { pop: string; area: string; rent: string; minwage: string }
export type DataKey = keyof DataSelection

export const SELECTABLE: Record<DataKey, { title: string; sources: Source[] }> = {
  pop:     { title: '人口',     sources: populationSources },
  area:    { title: '面積',     sources: areaSources },
  rent:    { title: '家賃',     sources: rentSources },
  minwage: { title: '最低賃金', sources: minWageSources },
}
export const DATA_KEYS = Object.keys(SELECTABLE) as DataKey[]

export const defaultDataSelection = (): DataSelection => ({
  pop: populationSources[0]?.path ?? '',
  area: areaSources[0]?.path ?? '',
  rent: rentSources[0]?.path ?? '',
  minwage: minWageSources[0]?.path ?? '',
})

export const selectedSource = (key: DataKey, selection: DataSelection): Source | undefined =>
  SELECTABLE[key].sources.find(s => s.path === selection[key])

/**
 * The selection lives in the URL (?pop=jumin:2025&area=2026-04-01) so that
 * reloading or sharing a page keeps it. Only non-default choices appear;
 * unknown keys (e.g. an edition since disabled) fall back to the default.
 */
export function selectionFromParams(params: URLSearchParams): DataSelection {
  const selection = defaultDataSelection()
  for (const k of DATA_KEYS) {
    const src = SELECTABLE[k].sources.find(s => s.key === params.get(k))
    if (src) selection[k] = src.path
  }
  return selection
}

export function writeSelectionParams(params: URLSearchParams, selection: DataSelection): URLSearchParams {
  const defaults = defaultDataSelection()
  for (const k of DATA_KEYS) {
    const src = selectedSource(k, selection)
    if (src && src.path !== defaults[k]) params.set(k, src.key)
    else params.delete(k)
  }
  return params
}

// ── Population ────────────────────────────────────────────────────────────────

export type PopulationRecord = Record<string, number>
export type PopulationMap = Map<string, PopulationRecord>

export const fetchPopulation = (path: string): Promise<PopulationMap> =>
  !path ? Promise.resolve(new Map()) : fetchCsv(path).then(rows => new Map(rows.map((r): [string, PopulationRecord] => {
    const record: PopulationRecord = {}
    for (const [k, v] of Object.entries(r)) if (k !== 'code') record[k] = toNum(v)
    return [r.code, record]
  })))

// ── Area ──────────────────────────────────────────────────────────────────────

export const fetchArea = (path: string): Promise<Map<string, number>> =>
  !path ? Promise.resolve(new Map()) : fetchCsv(path).then(rows => new Map(rows.map(r => [r.code, toNum(r.area)])))

// ── Rent ──────────────────────────────────────────────────────────────────────

// 住宅・土地統計調査 延べ面積１m²当たり家賃. The CSV has every 住宅の所有の関係
// (total/public/ur/private/company) both including (inc0) and excluding (exc0)
// zero-rent homes; only the totals are surfaced.
export type RentMap = Map<string, { inc0: number; exc0: number }>

export const fetchRent = (path: string): Promise<RentMap> =>
  !path ? Promise.resolve(new Map()) : fetchCsv(path).then(rows => new Map(
    rows.map((r): [string, { inc0: number; exc0: number }] => [r.code, { inc0: toNum(r.inc0_total), exc0: toNum(r.exc0_total) }])
  ))

// ── Minimum wage ──────────────────────────────────────────────────────────────

// 地域別最低賃金: one row per prefecture (keyed by the prefecture's own 5-digit
// code) per 年度. Every municipality in a prefecture shares its value, so the
// map is keyed by the 2-digit prefecture prefix.
export type MinWageMap = Map<string, { min: number; since: string }>
type MinWageRow = { code: string; min: number; since: string }

/**
 * A new 年度's rates take effect on different dates per prefecture (Oct–Mar),
 * so neither the newest nor the previous edition alone is "current". For each
 * prefecture, take the newest rate whose effective date has arrived.
 */
export const pickEffectiveMinWages = (editions: MinWageRow[][], today: string): MinWageMap => {
  const out: MinWageMap = new Map()
  for (const rows of editions) {          // newest edition first
    for (const r of rows) {
      const pref = r.code.slice(0, 2)
      if (out.has(pref)) continue
      if (r.since && r.since > today) continue
      out.set(pref, { min: r.min, since: r.since })
    }
  }
  return out
}

const minWageRows = (path: string): Promise<MinWageRow[]> =>
  fetchCsv(path).then(rows => rows.map(r => ({ code: r.code, min: toNum(r.min), since: r.since })))

export const fetchMinWages = (path: string): Promise<MinWageMap> => {
  if (!path) return Promise.resolve(new Map())
  if (path !== MINWAGE_EFFECTIVE) {
    // A specific 年度: its rates as published, effective or not yet.
    return minWageRows(path).then(rows => new Map(rows.map(r => [r.code.slice(0, 2), { min: r.min, since: r.since }])))
  }
  const eds = dataset('minwage').editions.slice(0, 2)
  return Promise.all(eds.map(e => minWageRows(e.path))).then(all =>
    pickEffectiveMinWages(all, new Date().toISOString().slice(0, 10)))
}

// ── Municipality codes and prefectures ────────────────────────────────────────

// 総務省統計局 標準地域コード: one row per prefecture, city, ward, or grouping
// (Hokkaido's 振興局, other prefectures' 郡). Rows the app has no area/population
// data for just render as "no data" — there's no need to tell them apart here.
// The pipeline has already resolved display names (ward → "札幌市中央区",
// town → "当別町" without its 郡/振興局 label; see scripts/data/datasets/codes.mjs).
export type CodeEntry = { code: string; kanji: string; kana: string }

export const parseCodesCsv = (raw: string): CodeEntry[] =>
  parseCsv(raw).map(r => ({ code: r.code, kanji: r.name, kana: r.kana }))

export const fetchMunicipalityCodes = (): Promise<CodeEntry[]> => {
  const e = latest('codes')
  return e ? fetch(`/${e.path}`).then(r => r.text()).then(parseCodesCsv) : Promise.resolve([])
}

// The codes above also include designated-city wards and grouping rows; this
// is the narrower set that are actual 地方公共団体, used to keep rankings to
// real municipalities.
export const officialCodes: Set<string> = new Set(dantaiCodes as string[])

/** 47 prefectures: 5-digit code, name, half-width kana, and the URL slug. */
export const prefectures = prefectureList

// ── Designations, coastline, map ──────────────────────────────────────────────

export type DesignationSets = {
  seirei:  Set<string>
  chukaku: Set<string>
  tokurei: Set<string>
}

export const fetchDesignations = (): Promise<DesignationSets> => {
  const sets: DesignationSets = { seirei: new Set(), chukaku: new Set(), tokurei: new Set() }
  const e = latest('designations')
  if (!e) return Promise.resolve(sets)
  return fetchCsv(e.path).then(rows => {
    for (const r of rows) sets[r.type as keyof DesignationSets]?.add(r.code)
    return sets
  })
}

// code → neighboring codes, plus the pseudo-neighbor "coast" for codes whose
// boundary touches the sea. Shared by &coastal and the detail page, so it's
// fetched once.
let adjacencyPromise: Promise<Record<string, string[]>> | null = null
export const fetchAdjacency = (): Promise<Record<string, string[]>> => {
  const path = latest('map')?.adjacency
  if (!path) return Promise.resolve({})
  return adjacencyPromise ??= fetch(`/${path}`).then(r => r.json() as Promise<Record<string, string[]>>)
}

/** Codes whose boundary touches the sea. */
export const fetchCoastal = (): Promise<Set<string>> =>
  fetchAdjacency().then(data => new Set(
    Object.entries(data).filter(([, neighbors]) => neighbors.includes('coast')).map(([code]) => code)
  ))

// ── Census comparison (人口増減, 国勢調査 2 回分) ───────────────────────────────

// The two most recent 国勢調査 (one edition per date: the 確定 edition when it
// is enabled, otherwise the 速報), newest first. Unlike the selectable
// population, a change between two censuses always compares these two.
export type CensusPair = { latest: Edition; prev: Edition }
export const censusPair = (): CensusPair | undefined => {
  const byDate: Edition[] = []
  for (const e of dataset('kokusei').editions) {
    if (!byDate.some(x => x.as_of === e.as_of)) byDate.push(e)
  }
  return byDate.length >= 2 ? { latest: byDate[0], prev: byDate[1] } : undefined
}
/** "2020→2025年" */
export const censusPeriod = (p: CensusPair | undefined = censusPair()): string =>
  p ? `${p.prev.as_of.slice(0, 4)}→${p.latest.as_of.slice(0, 4)}年` : ''

export type CensusMap = Map<string, { prev: number; latest: number }>
let censusPromise: Promise<CensusMap> | null = null
export const fetchCensusChange = (): Promise<CensusMap> => {
  const pair = censusPair()
  if (!pair) return Promise.resolve(new Map())
  return censusPromise ??= Promise.all([fetchCsv(pair.prev.path), fetchCsv(pair.latest.path)]).then(([prev, latest]) => {
    const out: CensusMap = new Map()
    const before = new Map(prev.map(r => [r.code, toNum(r.totalpop)]))
    for (const r of latest) out.set(r.code, { prev: before.get(r.code) ?? NaN, latest: toNum(r.totalpop) })
    return out
  })
}

// ── Population series (detail page) ───────────────────────────────────────────

export type SeriesPoint = { id: string; as_of: string; totalpop: number; setai: number }

/**
 * One municipality's 住民基本台帳 population for every enabled year, oldest
 * first — from the pipeline's derived series file, not the yearly files.
 */
export const fetchPopulationSeries = (code: string): Promise<SeriesPoint[]> => {
  const path = dataset('jumin').extras?.series
  if (!path) return Promise.resolve([])
  const years = dataset('jumin').editions
  return fetchCsv(path).then(rows => {
    const r = rows.find(x => x.code === code)
    if (!r) return []
    return years
      .map(e => ({ id: e.id, as_of: e.as_of, totalpop: toNum(r[`totalpop_${e.id}`]), setai: toNum(r[`setai_${e.id}`]) }))
      .filter(p => !Number.isNaN(p.totalpop))
      .sort((a, b) => a.as_of.localeCompare(b.as_of))
  })
}

/** The boundary TopoJSON the map draws (newest enabled edition). */
export const mapTopojsonPath = (): string | undefined => latest('map')?.path
