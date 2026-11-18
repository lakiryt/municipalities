import { describe, it, expect } from 'vitest'
import { parseAndTypeCheck } from '@/lang/expr'
import { NUM_VARS } from '@/lang/variables'
import { defaultDataSelection, populationSources, SELECTABLE, DATA_KEYS } from './datasets'
import { scopeOf, unavailableIn, unavailableMessage, fitSelection, ANY_DATA } from './schema'

const census = populationSources.find(s => s.dataset === 'kokusei')!
const withCensus = { ...defaultDataSelection(), pop: census.path }
const t = (src: string) => parseAndTypeCheck(src)

describe('what the selected data provides', () => {
  it('the default selection provides every variable', () => {
    expect([...scopeOf(defaultDataSelection()).keys()]).toEqual([])
  })

  it('every selectable edition lists its columns', () => {
    for (const k of DATA_KEYS) for (const s of SELECTABLE[k].sources)
      expect(s.columns.size, `${k} ${s.key}`).toBeGreaterThan(0)
  })

  it('国勢調査 has totals but no age brackets or 住民票 movements', () => {
    const scope = scopeOf(withCensus)
    expect(scope.has('totalpop')).toBe(false)
    expect(scope.has('femalepop')).toBe(false)
    expect(scope.get('total0_4')).toMatchObject({ variable: 'total0_4', missing: 'total0_4', key: 'pop' })
    expect(scope.has('setai')).toBe(true)
  })

  it('a derived variable is there exactly when what it is computed from is', () => {
    const scope = scopeOf(withCensus)
    expect(scope.has('popdensity')).toBe(false)                    // #totalpop / #area
    expect(scope.get('elderly_total')).toMatchObject({ missing: 'total65_69' })
    expect(scope.get('inc_rate')?.variable).toBe('inc_rate')       // via #inc_net, #prev_total
    expect(scope.has('pop_change_rate')).toBe(false)               // 人口増減, not 人口
  })

  it('only the variables of NUM_VARS are ever reported', () => {
    for (const v of scopeOf(withCensus).keys()) expect(NUM_VARS).toContain(v)
  })
})

describe('checking expressions against it', () => {
  it('lists each unavailable variable an expression uses, through column references too', () => {
    const scope = scopeOf(withCensus)
    expect(unavailableIn([t('#totalpop / #area')], scope)).toEqual([])
    expect(unavailableIn([t('#elderly_total / #totalpop'), t('#setai')], scope).map(u => u.variable))
      .toEqual(['elderly_total', 'setai'])
    const col = { id: 0, typed: t('#total0_4') }
    expect(unavailableIn([parseAndTypeCheck('@0 + 1', [col])], scope).map(u => u.variable)).toEqual(['total0_4'])
  })

  it('without a selection nothing is unavailable', () => {
    expect(unavailableIn([t('#total0_4')], ANY_DATA)).toEqual([])
  })

  it('says which edition lacks what', () => {
    const [direct] = unavailableIn([t('#setai')], scopeOf(withCensus))
    expect(unavailableMessage(direct)).toBe(`「国勢調査 ${census.name}」には #setai がありません`)
    const [derived] = unavailableIn([t('#elderly_total')], scopeOf(withCensus))
    expect(unavailableMessage(derived)).toBe(`「国勢調査 ${census.name}」には #elderly_total の計算に使う #total65_69 がありません`)
  })
})

describe('fitting a selection to fixed expressions', () => {
  it('keeps a selection that has everything', () => {
    expect(fitSelection(withCensus, [t('#totalpop')])).toBe(withCensus)
  })

  it('switches only the dataset that lacks something', () => {
    const rentChoice = SELECTABLE.rent.sources.at(-1)!.path
    const fitted = fitSelection({ ...withCensus, rent: rentChoice }, [t('#elderly_total'), t('#rent_private')])
    expect(fitted.pop).toBe(defaultDataSelection().pop)
    expect(fitted.rent).toBe(rentChoice)
  })
})
