// e-Stat API v3.0 client (JSON). Needs an application ID in ESTAT_APP_ID
// (put it in .env.local — see DATA_PIPELINE.md). The appId is appended to
// requests only; logs, errors, the cache and the fetch log see the URL
// without it.
import { existsSync } from 'node:fs'
import { download, getPage, readCached, cachePath } from './fetch.mjs'

const API = 'https://api.e-stat.go.jp/rest/3.0/app/json'

export const hasAppId = () => Boolean(process.env.ESTAT_APP_ID)

function withAppId(url) {
  const appId = process.env.ESTAT_APP_ID
  if (!appId) throw new Error('ESTAT_APP_ID が未設定です（.env.local に ESTAT_APP_ID=... を書く）')
  return `${url}&appId=${encodeURIComponent(appId)}`
}

const apiUrl = (endpoint, params) => `${API}/${endpoint}?${new URLSearchParams(params)}`

/** Every API response carries RESULT.STATUS: 0–2 is success, 100+ an error. */
function checked(body, what) {
  const status = body?.RESULT?.STATUS
  if (status === undefined || status >= 100) throw new Error(`e-Stat API error ${status} (${what}): ${body?.RESULT?.ERROR_MSG}`)
  return body
}

// ── getStatsData: one table's values, cached page by page ─────────────────────

const pageKey = (statsDataId, page) => `estat/${statsDataId}/page-${page}.json`

/** Downloads every page of a stats table into the cache (following NEXT_KEY). */
export async function fetchStatsData(statsDataId, opts) {
  for (let start = 1, page = 1; ; page++) {
    const url = apiUrl('getStatsData', { statsDataId, limit: 100000, startPosition: start, metaGetFlg: 'Y', cntGetFlg: 'N', sectionHeaderFlg: 1 })
    const buf = await download(withAppId(url), pageKey(statsDataId, page), { ...opts, logUrl: url })
    const body = checked(JSON.parse(buf.toString('utf-8')).GET_STATS_DATA, `getStatsData ${statsDataId}`)
    const next = body.STATISTICAL_DATA?.RESULT_INF?.NEXT_KEY
    if (!next) return
    start = next
  }
}

/**
 * Reads all cached pages and returns values with every classification
 * resolved to its name: [{ area, time, dims: {tab: '人口', cat01: '男', area: '札幌市', ...}, value }].
 */
export function readStatsData(statsDataId) {
  const values = []
  let classes = null
  for (let page = 1; existsSync(cachePath(pageKey(statsDataId, page))); page++) {
    const sd = JSON.parse(readCached(pageKey(statsDataId, page)).toString('utf-8')).GET_STATS_DATA.STATISTICAL_DATA
    classes ??= Object.fromEntries([sd.CLASS_INF.CLASS_OBJ].flat().map(o =>
      [o['@id'], new Map([o.CLASS].flat().map(c => [c['@code'], c['@name']]))]))
    values.push(...[sd.DATA_INF.VALUE].flat())
  }
  return values.map(v => {
    const dims = {}
    for (const [key, raw] of Object.entries(v)) {
      if (!key.startsWith('@') || key === '@unit') continue
      dims[key.slice(1)] = classes[key.slice(1)]?.get(raw) ?? raw
    }
    return { area: v['@area'], time: v['@time'], dims, value: v.$ }
  })
}

// ── getStatsList: search tables (not cached — used for discovery) ─────────────

const text = (v) => String(typeof v === 'object' && v !== null ? v.$ : v ?? '')

/** Every table matching the params. Returns [{ id, statsName, title, surveyDate, openDate }]. */
export async function statsList(params, { log = () => {} } = {}) {
  const out = []
  for (let start = 1; ;) {
    const url = apiUrl('getStatsList', { ...params, limit: 1000, startPosition: start })
    const raw = await getPage(withAppId(url), { log, logUrl: url })
    const body = checked(JSON.parse(raw.toString('utf-8')).GET_STATS_LIST, 'getStatsList')
    // A table is listed once per 集計地域区分 (全国/都道府県/市区町村); keep one.
    for (const t of [body.DATALIST_INF?.TABLE_INF ?? []].flat()) {
      if (out.some(o => o.id === t['@id'])) continue
      out.push({ id: t['@id'], statsName: text(t.STATISTICS_NAME), title: text(t.TITLE), surveyDate: String(t.SURVEY_DATE), openDate: t.OPEN_DATE })
    }
    const next = body.DATALIST_INF?.RESULT_INF?.NEXT_KEY
    if (!next) return out
    start = next
  }
}
