// Every ranking, computed on the data actually shipped in public/ (the
// default データの選択). The catalog test checks that the expressions are
// well-typed; this checks that the data behind them is there — a new
// edition with a renamed column, or a dataset mapped to the wrong field,
// shows up here as a ranking with (almost) nothing in it, not on the site.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { parseAndTypeCheck } from '@/lang/expr'
import { evaluate } from '@/lang/evaluate'
import { baseItemEnv, type BaseItem } from '@/data/municipalities'
import type { DesignationSets } from '@/data/datasets'
import { loadDefaultItems } from './featuredSnapshot'
import { RANKINGS, type CatalogEntry } from './catalog'
import type { Pref } from './filters'

// The fewest rows a ranking may have. The smallest national list is the
// 政令指定都市 (20); everything else has hundreds or more.
const MIN_ROWS = 20

let data: { items: BaseItem[]; designations: DesignationSets | undefined; coastal: Set<string> }

// The app fetches /data/… from the site root; here those files are read
// from public/ (through Vite, loaded only when asked for).
const files = import.meta.glob<string>('/public/data/**/*.{csv,json}', { query: '?raw', import: 'default' })

beforeAll(async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const load = files[`/public${url.split('?')[0]}`]
    if (!load) throw new Error(`no such data file: ${url}`)
    return new Response(await load())
  })
  data = await loadDefaultItems()
}, 60_000)
afterAll(() => { vi.unstubAllGlobals() })

/** Rows the ranking shows, and how many of them have a value to rank by. */
function rows(e: CatalogEntry, pref: Pref | null) {
  const config = e.configFor(pref)
  const filter = config.filterExpression ? parseAndTypeCheck(config.filterExpression) : null
  const sort = parseAndTypeCheck(config.sortExpression)
  let shown = 0, ranked = 0
  for (const item of data.items) {
    const env = baseItemEnv(item, data.designations, data.coastal)
    if (filter && evaluate(filter, env) !== true) continue
    shown++
    if (Number.isFinite(evaluate(sort, env) as number)) ranked++
  }
  return { shown, ranked }
}

describe('every ranking, on the shipped data', () => {
  for (const e of RANKINGS) {
    it(`${e.slug}: has rows, and a value to rank most of them by`, () => {
      const { shown, ranked } = rows(e, null)
      expect(ranked, `${e.slug}: ${ranked} of ${shown} rows have a value`).toBeGreaterThanOrEqual(MIN_ROWS)
      // A dataset that is there for some rows only (家賃: surveyed areas) is
      // fine; one that is there for almost none is a broken join.
      expect(ranked / shown, `${e.slug}: ${ranked} of ${shown} rows have a value`).toBeGreaterThan(0.5)
    })
  }
})
