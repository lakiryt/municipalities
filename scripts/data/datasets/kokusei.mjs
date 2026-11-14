// 国勢調査 (e-Stat API). Editions are registered by hand in sources.json
// (statsDataId) — the tables differ between censuses, so there's no reliable
// automatic discovery. `discover` checks each registered table still exists.
import { resolve } from 'node:path'
import { writeCsv } from '../lib/csv.mjs'
import { toCode5 } from '../lib/code.mjs'
import { toNumber } from '../lib/text.mjs'
import { fetchStatsData, readStatsData, statsExists, hasAppId } from '../lib/estat.mjs'
import { fetchRecord } from '../lib/fetch.mjs'
import { PUBLIC_DIR, rel } from '../lib/paths.mjs'

export async function discover(src, opts) {
  const out = []
  for (const e of src.editions) {
    const available = hasAppId() ? await statsExists(e.statsDataId, opts) : null
    out.push({ id: e.id, as_of: e.as_of, label: e.label, ref: { ...e }, available })
  }
  return out
}

export async function fetchEdition(src, ref, opts) {
  if (!hasAppId()) throw new Error('ESTAT_APP_ID が未設定です（.env.local に ESTAT_APP_ID=... を書く）')
  await fetchStatsData(ref.statsDataId, opts)
}

// Which output column a value belongs to, from its classification names.
// Anything describing change or ratios (増減, 率, 割合) or a non-total
// breakdown we don't keep is ignored.
function columnFor(names) {
  const s = names.join(' ')
  if (/増減|率|割合|密度|面積/.test(s)) return null
  if (/世帯/.test(s)) return 'setai'
  if (/男/.test(s)) return 'malepop'
  if (/女/.test(s)) return 'femalepop'
  if (/総数|総計|^人口$|男女計|人口 ?総数/.test(s) || names.every(n => /人口/.test(n))) return 'totalpop'
  return null
}

export function transform(values) {
  // If the table holds several time points, keep only the newest.
  const latest = values.map(v => v.time).filter(Boolean).sort().at(-1)
  const rows = new Map()
  const ignored = new Set()
  for (const v of values) {
    if (latest && v.time !== latest) continue
    const code = toCode5(v.area)
    if (!code) continue
    const names = Object.entries(v.dims).filter(([k]) => k !== 'area' && k !== 'time').map(([, n]) => n)
    const col = columnFor(names)
    if (!col) { ignored.add(names.join(' / ')); continue }
    const rec = rows.get(code) ?? { code }
    if (rec[col] !== undefined) throw new Error(`国勢調査: ${code} の ${col} に複数の値が対応しました (${names.join(' / ')})。columnFor() を見直してください`)
    rec[col] = toNumber(v.value)
    rows.set(code, rec)
  }
  return { rows: [...rows.values()].sort((a, b) => a.code.localeCompare(b.code)), ignored: [...ignored] }
}

export async function buildEdition(src, ref, opts) {
  const abs = resolve(PUBLIC_DIR, `data/kokusei/${ref.id}.csv`)
  const { rows, ignored } = transform(readStatsData(ref.statsDataId))
  if (ignored.length) opts.log(`  note    ${ref.id}: 使わなかった分類: ${ignored.slice(0, 8).join(' | ')}${ignored.length > 8 ? ' …' : ''}`)
  const columns = ['code', 'totalpop', 'malepop', 'femalepop', ...(rows.some(r => r.setai !== undefined) ? ['setai'] : [])]
  const out = writeCsv(abs, columns, rows)
  const rec = fetchRecord(`estat/${ref.statsDataId}/page-1.json`)
  return {
    id: ref.id, as_of: ref.as_of, label: ref.label, path: rel(abs).replace(/^public\//, ''), rows: out.rows,
    source: { url: `e-Stat API statsDataId=${ref.statsDataId}`, retrieved_at: rec?.retrieved_at.slice(0, 10), sha256: rec?.sha256 },
  }
}
