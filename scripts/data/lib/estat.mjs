// e-Stat API v3.0 client (getStatsData, JSON). Needs an application ID in
// ESTAT_APP_ID (put it in .env.local — see DATA_PIPELINE.md).
import { download, readCached } from './fetch.mjs'
import { existsSync } from 'node:fs'
import { cachePath } from './fetch.mjs'

const BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData'
const LIMIT = 100000

export const hasAppId = () => Boolean(process.env.ESTAT_APP_ID)

const pageKey = (statsDataId, page) => `estat/${statsDataId}/page-${page}.json`

/**
 * Downloads every page of a stats table into the cache (following NEXT_KEY).
 * The appId is never written to the cache or the fetch log.
 */
export async function fetchStatsData(statsDataId, opts) {
  const appId = process.env.ESTAT_APP_ID
  if (!appId) throw new Error('ESTAT_APP_ID が未設定です（.env.local に ESTAT_APP_ID=... を書く）')
  let start = 1, page = 1
  for (;;) {
    const url = `${BASE}?statsDataId=${statsDataId}&limit=${LIMIT}&startPosition=${start}&metaGetFlg=Y&cntGetFlg=N&sectionHeaderFlg=1`
    const buf = await download(`${url}&appId=${appId}`, pageKey(statsDataId, page), { ...opts, logUrl: url })
    const body = JSON.parse(buf.toString('utf-8')).GET_STATS_DATA
    const status = body?.RESULT?.STATUS
    if (status === undefined || status >= 100) throw new Error(`e-Stat API error ${status}: ${body?.RESULT?.ERROR_MSG}`)
    const next = body.STATISTICAL_DATA?.RESULT_INF?.NEXT_KEY
    if (!next) return page
    start = next; page++
  }
}

export const isCached = (statsDataId) => existsSync(cachePath(pageKey(statsDataId, 1)))

/** Whether the table still exists (getMetaInfo returns STATUS 0). */
export async function statsExists(statsDataId, { log = () => {} } = {}) {
  const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo?statsDataId=${statsDataId}`
  log(`  GET     ${url}`)
  const res = await fetch(`${url}&appId=${process.env.ESTAT_APP_ID}`, { headers: { 'User-Agent': 'municipalities-data-pipeline' } })
  if (!res.ok) throw new Error(`e-Stat API HTTP ${res.status} (getMetaInfo ${statsDataId})`)
  const status = (await res.json()).GET_META_INFO?.RESULT?.STATUS
  return status === 0
}

/**
 * Reads all cached pages and returns values with every classification
 * resolved to its name: [{ area, time, dims: {tab: '人口', cat01: '男', ...}, value }].
 */
export function readStatsData(statsDataId) {
  const values = []
  let classes = null
  for (let page = 1; existsSync(cachePath(pageKey(statsDataId, page))); page++) {
    const sd = JSON.parse(readCached(pageKey(statsDataId, page)).toString('utf-8')).GET_STATS_DATA.STATISTICAL_DATA
    if (!classes) classes = classMaps(sd.CLASS_INF.CLASS_OBJ)
    for (const v of [sd.DATA_INF.VALUE].flat()) values.push(v)
  }
  return values.map(v => {
    const dims = {}
    for (const [key, raw] of Object.entries(v)) {
      if (!key.startsWith('@') || key === '@unit') continue
      const id = key.slice(1)
      dims[id] = classes[id]?.get(raw) ?? raw
    }
    return { area: v['@area'], time: v['@time'], dims, value: v.$ }
  })
}

function classMaps(objs) {
  return Object.fromEntries([objs].flat().map(o => [o['@id'], new Map([o.CLASS].flat().map(c => [c['@code'], c['@name']]))]))
}
