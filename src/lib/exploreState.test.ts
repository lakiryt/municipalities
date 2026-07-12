import { describe, it, expect } from 'vitest'
import { encodeExploreState, decodeExploreState, nextColumnId, type ExploreState } from './exploreState'

const sample: ExploreState = {
  columns: [
    { id: 0, label: '総人口', expression: '#totalpop' },
    { id: 1, label: '面積', expression: '#area' },
  ],
  filterExpression: 'LEQ(#totalpop, 100000)',
  sortExpression: '@0',
  sortDirection: 'desc',
}

describe('encode/decode round trip', () => {
  it('decodes exactly what was encoded', () => {
    expect(decodeExploreState(encodeExploreState(sample))).toEqual(sample)
  })

  it('round-trips expressions containing URL-hostile characters (#, &, commas, spaces, quotes)', () => {
    const state: ExploreState = {
      columns: [{ id: 0, label: '判定', expression: 'AND(EQ($prefkanji, "東京都"), LEQ(#totalpop, 100000))' }],
      filterExpression: '',
      sortExpression: '',
      sortDirection: 'asc',
    }
    expect(decodeExploreState(encodeExploreState(state))).toEqual(state)
  })
})

describe('decodeExploreState with untrusted input', () => {
  it('returns null for null/empty input', () => {
    expect(decodeExploreState(null)).toBeNull()
    expect(decodeExploreState('')).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(decodeExploreState('{not json')).toBeNull()
  })

  it('returns null when columns is missing or not an array', () => {
    expect(decodeExploreState(JSON.stringify({ filterExpression: '' }))).toBeNull()
    expect(decodeExploreState(JSON.stringify({ columns: 'nope' }))).toBeNull()
  })

  it('drops malformed column entries and keeps well-formed ones', () => {
    const raw = JSON.stringify({
      columns: [
        { id: 0, label: 'ok', expression: '#totalpop' },
        { id: 'not-a-number', label: 'bad id', expression: '#area' },
        { label: 'missing id', expression: '#area' },
        { id: 2, expression: '#area' }, // missing label
        'not even an object',
      ],
    })
    const result = decodeExploreState(raw)
    expect(result?.columns).toEqual([{ id: 0, label: 'ok', expression: '#totalpop' }])
  })

  it('returns null if every column entry is malformed (nothing left to show)', () => {
    const raw = JSON.stringify({ columns: [{ label: 'no id or expression' }] })
    expect(decodeExploreState(raw)).toBeNull()
  })

  it('defaults filter/sort fields when absent or the wrong type', () => {
    const raw = JSON.stringify({ columns: [{ id: 0, label: 'x', expression: '#area' }], sortDirection: 'sideways' })
    expect(decodeExploreState(raw)).toEqual({
      columns: [{ id: 0, label: 'x', expression: '#area' }],
      filterExpression: '',
      sortExpression: '',
      sortDirection: 'desc',
    })
  })

  it('accepts an explicit sortDirection of "asc"', () => {
    const raw = JSON.stringify({ columns: [{ id: 0, label: 'x', expression: '#area' }], sortDirection: 'asc' })
    expect(decodeExploreState(raw)?.sortDirection).toBe('asc')
  })
})

describe('nextColumnId', () => {
  it('starts at 0 for an empty column list', () => {
    expect(nextColumnId([])).toBe(0)
  })

  it('returns one past the highest existing id, regardless of order', () => {
    expect(nextColumnId([{ id: 0 }, { id: 5 }, { id: 2 }])).toBe(6)
  })

  it('is stable under deletion — removing a non-max column does not change the next id', () => {
    const cols = [{ id: 0 }, { id: 1 }, { id: 2 }]
    const afterDeletingMiddle = cols.filter(c => c.id !== 1)
    expect(nextColumnId(afterDeletingMiddle)).toBe(3)
  })
})
