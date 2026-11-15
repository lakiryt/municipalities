import { describe, it, expect } from 'vitest'
import { parseAndTypeCheck } from '@/lang/expr'
import { DETAIL_METRICS } from '@/data/metrics'
import { RANKINGS, ranking } from './catalog'
import { featuredRankings } from './featured'

const SHIMANE = { kanji: '島根県' }

describe('the ranking catalog', () => {
  it('has each slug once', () => {
    const slugs = RANKINGS.map(e => e.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  // Every ranking, nationally and (where it exists) for a prefecture: the
  // columns, the starting filter and the sort all type-check, with the
  // types they need.
  for (const e of RANKINGS) {
    for (const pref of e.perPref ? [null, SHIMANE] : [null]) {
      it(`${e.slug} (${pref ? pref.kanji : '全国'}) is a valid ranking`, () => {
        const config = e.configFor(pref)
        const ids = config.columns.map((c, i) => c.id ?? i)
        expect(new Set(ids).size).toBe(ids.length)
        for (const c of config.columns) expect(() => parseAndTypeCheck(c.expression)).not.toThrow()
        if (config.filterExpression) expect(parseAndTypeCheck(config.filterExpression).type).toBe('b')
        expect(parseAndTypeCheck(config.sortExpression).type).toBe('n')
      })
    }
  }

  it('is what the detail page\'s figures link to', () => {
    for (const m of DETAIL_METRICS) if (m.ranking) expect(() => ranking(m.ranking!)).not.toThrow()
  })
})

describe('the home carousel', () => {
  it('maps a numeric column of each ranking it features', () => {
    for (const f of featuredRankings()) {
      const column = f.config.columns.find((c, i) => (c.id ?? i) === f.mapColumn)
      expect(column, f.path).toBeDefined()
      expect(parseAndTypeCheck(column!.expression).type).toBe('n')
    }
  })
})
