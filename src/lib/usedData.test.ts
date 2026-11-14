import { describe, it, expect } from 'vitest'
import { usedData } from './usedData'
import { selectionFromParams, writeSelectionParams, defaultDataSelection, SELECTABLE } from '@/data/datasets'

describe('usedData', () => {
  it('maps variables to the datasets they come from', () => {
    expect([...usedData(['#totalpop']).selectable]).toEqual(['pop'])
    expect([...usedData(['#area']).selectable]).toEqual(['area'])
    expect([...usedData(['MULT(30,#rent_exc0,INV(MULT(#minwage,8)))']).selectable].sort()).toEqual(['minwage', 'rent'])
  })

  it('expands derived variables into what they are computed from', () => {
    // #popdensity = #totalpop / #area
    expect([...usedData(['#popdensity']).selectable].sort()).toEqual(['area', 'pop'])
  })

  it('uses nothing for name/code-only expressions, and notices designation and coastline flags', () => {
    const u = usedData(['$kanji', '$code', 'AND(&seirei, &coastal)'])
    expect(u.selectable.size).toBe(0)
    expect(u.designations).toBe(true)
    expect(u.coastal).toBe(true)
  })

  it('treats 人口増減 as its own data, separate from the population', () => {
    expect([...usedData(['ROUND(MULT(#pop_change_rate, 100), 2)']).selectable]).toEqual(['change'])
    expect([...usedData(['#totalpop']).selectable]).toEqual(['pop'])
  })
})

describe('data selection in the URL', () => {
  it('round-trips a non-default edition, and leaves defaults out of the URL', () => {
    const areas = SELECTABLE.area.sources
    if (areas.length < 2) return   // nothing to choose between in this data snapshot
    const selection = { ...defaultDataSelection(), area: areas[1].path }
    const params = writeSelectionParams(new URLSearchParams(), selection)
    expect([...params.keys()]).toEqual(['area'])
    expect(selectionFromParams(params)).toEqual(selection)
  })

  it('falls back to the default for an unknown edition key', () => {
    expect(selectionFromParams(new URLSearchParams('area=1999-01-01'))).toEqual(defaultDataSelection())
  })
})
